"""Import the reference repository's source-backed NBA team Synergy export."""
from __future__ import annotations

import json
import os
import ssl
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get("COURTMATCH_PUBLISHED_DATA_DIR", ROOT / "public" / "data"))
SOURCE = os.environ.get(
    "COURTMATCH_TEAM_PLAYTYPE_SOURCE",
    "https://raw.githubusercontent.com/suren504/surennba_stats/main/data/team_stats/2025-26NBA_Synergy_stats.xlsx",
)
# GitHub reports the current source file revision as 2026-05-17. Do not replace this
# with the import time: the source snapshot itself is older than the import.
SOURCE_UPDATED_AT = os.environ.get("COURTMATCH_TEAM_PLAYTYPE_SOURCE_UPDATED_AT", "2026-05-17T09:21:44Z")
PLAY_TYPES = {"Isolation", "Transition", "PRBallHandler", "PRRollman", "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"}


def download(path: Path) -> Path:
    try:
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()
    with urlopen(SOURCE, timeout=60, context=context) as response:
        path.write_bytes(response.read())
    return path


def numeric(row: dict, key: str, *, nullable: bool = False):
    value = row.get(key)
    if pd.isna(value):
        return None if nullable else 0.0
    result = float(value)
    if not pd.notna(result):
        return None if nullable else 0.0
    return round(result, 4)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    teams = json.loads((OUTPUT / "teams.json").read_text(encoding="utf8"))
    known_team_ids = {str(team["id"]) for team in teams}
    with tempfile.TemporaryDirectory() as directory:
        frame = pd.read_excel(download(Path(directory) / "team-synergy.xlsx"))
    frame.columns = frame.columns.str.lower()
    required = {"team_id", "play_type_custom", "type_grouping_custom", "season_type_custom", "poss", "poss_pct", "ppp", "percentile", "gp"}
    if not required.issubset(frame.columns):
        raise ValueError(f"team Synergy export is missing columns: {sorted(required - set(frame.columns))}")

    records = []
    for source_row in frame.to_dict("records"):
        team_value = source_row["team_id"]
        team_id = str(int(team_value)) if pd.notna(team_value) else ""
        play_type = str(source_row["play_type_custom"])
        grouping = str(source_row["type_grouping_custom"]).lower()
        season_type = {"Regular Season": "regular", "Playoffs": "playoffs"}.get(str(source_row["season_type_custom"]))
        if team_id not in known_team_ids or play_type not in PLAY_TYPES or grouping not in {"offensive", "defensive"} or season_type is None:
            continue
        record = {
            "teamId": team_id,
            "playType": play_type,
            "grouping": grouping,
            "possessions": numeric(source_row, "poss"),
            "possessionShare": numeric(source_row, "poss_pct", nullable=True),
            "pointsPerPossession": numeric(source_row, "ppp", nullable=True),
            "percentile": numeric(source_row, "percentile", nullable=True),
            "gamesPlayed": numeric(source_row, "gp"),
            "season": "2025-26",
            "seasonType": season_type,
            "updatedAt": SOURCE_UPDATED_AT,
        }
        records.append(record)

    if len(records) < 600:
        raise ValueError(f"team Synergy export is unexpectedly incomplete: {len(records)} rows")
    keys = [(r["teamId"], r["playType"], r["grouping"], r["seasonType"]) for r in records]
    if len(keys) != len(set(keys)):
        raise ValueError("team Synergy export contains duplicate team/play type/side/season rows")
    if {row["teamId"] for row in records} != known_team_ids:
        raise ValueError("team Synergy export does not cover every published NBA team")

    manifest_path = OUTPUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    manifest.update({
        "teamPlaytypes": "team-playtypes.json",
        "teamPlaytypeRecordCount": len(records),
        "teamPlaytypesSourceUpdatedAt": SOURCE_UPDATED_AT,
    })
    source_age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(SOURCE_UPDATED_AT.replace("Z", "+00:00"))).days
    if source_age_days > 30:
        manifest["status"] = "stale"
    base_coverage = manifest.get("coverage", "NBA").split(" · Synergy", 1)[0]
    player_snapshot = manifest.get("playerPlaytypesSourceUpdatedAt")
    snapshots = [f"player {player_snapshot[:10]}"] if player_snapshot else []
    snapshots.append(f"team {SOURCE_UPDATED_AT[:10]}")
    manifest["coverage"] = f"{base_coverage} · Synergy snapshots: {', '.join(snapshots)}"
    stage = OUTPUT / ".team-playtypes.tmp"
    stage.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    stage.replace(OUTPUT / "team-playtypes.json")
    manifest_stage = OUTPUT / ".manifest.tmp"
    manifest_stage.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    manifest_stage.replace(manifest_path)
    print(f"Imported {len(records)} source-backed team Synergy rows across {len(known_team_ids)} NBA teams.")


if __name__ == "__main__":
    main()
