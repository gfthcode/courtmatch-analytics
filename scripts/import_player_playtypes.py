"""Import source-backed NBA player Synergy rows with team and season context."""
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
    "COURTMATCH_PLAYER_PLAYTYPE_SOURCE",
    "https://raw.githubusercontent.com/suren504/surennba_stats/main/data/2025-26_player_playtype.xlsx",
)
SOURCE_UPDATED_AT = os.environ.get("COURTMATCH_PLAYER_PLAYTYPE_SOURCE_UPDATED_AT", "2026-06-12T04:21:59Z")
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


def numeric(value, *, nullable: bool = False):
    if pd.isna(value):
        return None if nullable else 0.0
    result = float(value)
    return round(result, 4) if pd.notna(result) else (None if nullable else 0.0)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    players = json.loads((OUTPUT / "players.json").read_text(encoding="utf8"))
    teams = json.loads((OUTPUT / "teams.json").read_text(encoding="utf8"))
    player_ids = {str(row["id"]) for row in players}
    team_ids = {str(row["id"]) for row in teams}
    with tempfile.TemporaryDirectory() as directory:
        frame = pd.read_excel(download(Path(directory) / "player-synergy.xlsx"))
    frame.columns = frame.columns.str.lower()
    required = {"player_id", "team_id", "play_type_custom", "type_grouping_custom", "season_type_custom", "poss", "ppp", "percentile", "gp"}
    if not required.issubset(frame.columns):
        raise ValueError(f"player Synergy export is missing columns: {sorted(required - set(frame.columns))}")

    records = []
    for source_row in frame.to_dict("records"):
        player_value, team_value = source_row["player_id"], source_row["team_id"]
        player_id = str(int(player_value)) if pd.notna(player_value) else ""
        team_id = str(int(team_value)) if pd.notna(team_value) else ""
        play_type = str(source_row["play_type_custom"])
        grouping = str(source_row["type_grouping_custom"]).lower()
        season_type = {"Regular Season": "regular", "Playoffs": "playoffs"}.get(str(source_row["season_type_custom"]))
        if player_id not in player_ids or team_id not in team_ids or play_type not in PLAY_TYPES or grouping not in {"offensive", "defensive"} or season_type is None:
            continue
        records.append({
            "playerId": player_id,
            "teamId": team_id,
            "playType": play_type,
            "grouping": grouping,
            "possessions": numeric(source_row["poss"]),
            "pointsPerPossession": numeric(source_row["ppp"], nullable=True),
            "percentile": numeric(source_row["percentile"], nullable=True),
            "gamesPlayed": numeric(source_row["gp"]),
            "season": "2025-26",
            "seasonType": season_type,
            "updatedAt": SOURCE_UPDATED_AT,
        })

    if len(records) < 5000:
        raise ValueError(f"player Synergy export is unexpectedly incomplete: {len(records)} rows")
    keys = [(r["playerId"], r["teamId"], r["playType"], r["grouping"], r["seasonType"]) for r in records]
    if len(keys) != len(set(keys)):
        raise ValueError("player Synergy export contains duplicate player/team/play type/side/season rows")

    manifest_path = OUTPUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    manifest.update({
        "playtypes": "playtypes.json",
        "playtypeRecordCount": len(records),
        "playerPlaytypesSourceUpdatedAt": SOURCE_UPDATED_AT,
    })
    source_age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(SOURCE_UPDATED_AT.replace("Z", "+00:00"))).days
    if source_age_days > 30:
        manifest["status"] = "stale"
    base_coverage = manifest.get("coverage", "NBA").split(" · Synergy", 1)[0]
    team_snapshot = manifest.get("teamPlaytypesSourceUpdatedAt")
    snapshots = [f"player {SOURCE_UPDATED_AT[:10]}"]
    if team_snapshot:
        snapshots.append(f"team {team_snapshot[:10]}")
    manifest["coverage"] = f"{base_coverage} · Synergy snapshots: {', '.join(snapshots)}"
    stage = OUTPUT / ".playtypes.tmp"
    stage.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    stage.replace(OUTPUT / "playtypes.json")
    manifest_stage = OUTPUT / ".manifest.tmp"
    manifest_stage.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    manifest_stage.replace(manifest_path)
    print(f"Imported {len(records)} source-backed player Synergy rows ({sum(r['seasonType'] == 'regular' for r in records)} regular, {sum(r['seasonType'] == 'playoffs' for r in records)} playoffs).")


if __name__ == "__main__":
    main()
