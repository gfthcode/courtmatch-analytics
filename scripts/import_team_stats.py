"""Normalize the reference repository's public pbpstats team exports.

The team export supplies offense; the opponent export supplies points allowed.
Only directly observed source values are published. Ratings are computed from
source points / source possessions, not estimated from player box scores.
"""
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
BASE = "https://raw.githubusercontent.com/suren504/surennba_stats/main/data/team_stats"
SNAPSHOT_AT = os.environ.get("COURTMATCH_TEAM_STATS_SOURCE_UPDATED_AT", "2026-09-26T20:31:54Z")
SOURCES = (
    ("2025-26NBA_RegularSeason_Team_stats.xlsx", "2025-26", "regular", "team"),
    ("2025-26NBA_RegularSeason_Opponent_stats.xlsx", "2025-26", "regular", "opponent"),
    ("2025-26NBA_Playoffs_Team_stats.xlsx", "2025-26", "playoffs", "team"),
    ("2025-26NBA_Playoffs_Opponent_stats.xlsx", "2025-26", "playoffs", "opponent"),
)


def read_source(filename: str, directory: Path, season_type: str, side: str) -> pd.DataFrame:
    source = os.environ.get(f"COURTMATCH_TEAM_STATS_{season_type.upper()}_{side.upper()}_SOURCE")
    if not source:
        source = f"{BASE}/{filename}"
    if source.startswith(("http://", "https://")):
        try:
            import certifi
            context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            context = ssl.create_default_context()
        with urlopen(source, timeout=60, context=context) as response:
            path = directory / filename
            path.write_bytes(response.read())
    else:
        path = Path(source)
        if not path.is_file():
            raise FileNotFoundError(f"team stats source not found: {source}")
    frame = pd.read_excel(path)
    frame.columns = frame.columns.str.lower().str.strip()
    required = {"teamid", "gamesplayed", "offposs", "defposs", "points", "pace"}
    if not required.issubset(frame.columns):
        raise ValueError(f"{filename} missing fields: {sorted(required - set(frame.columns))}")
    return frame


def number(row: pd.Series, key: str) -> float | None:
    value = row.get(key)
    if pd.isna(value):
        return None
    result = float(value)
    if not pd.notna(result):
        return None
    return round(result, 4)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    teams = json.loads((OUTPUT / "teams.json").read_text(encoding="utf8"))
    team_ids = {str(team["id"]) for team in teams}
    if len(team_ids) != 30:
        raise ValueError(f"expected 30 canonical NBA teams, got {len(team_ids)}")
    snapshot = datetime.fromisoformat(SNAPSHOT_AT.replace("Z", "+00:00"))
    if snapshot.tzinfo is None:
        raise ValueError("team stats source timestamp must include a timezone")

    frames: dict[tuple[str, str], dict[str, pd.DataFrame]] = {}
    with tempfile.TemporaryDirectory(prefix="courtmatch-team-stats-") as temp:
        temp_dir = Path(temp)
        for filename, season, season_type, side in SOURCES:
            frame = read_source(filename, temp_dir, season_type, side)
            frame["teamid"] = frame["teamid"].map(lambda value: str(int(value)) if pd.notna(value) else "")
            rows = frame.set_index("teamid", drop=False)
            valid_ids = set(rows.index) & team_ids
            required_count = 30 if season_type == "regular" else 16
            if len(valid_ids) < required_count:
                raise ValueError(f"{filename} has {len(valid_ids)} valid teams; expected at least {required_count}")
            frames.setdefault((season, season_type), {})[side] = rows.loc[sorted(valid_ids)]

    records = []
    for (season, season_type), pair in sorted(frames.items()):
        if set(pair) != {"team", "opponent"}:
            raise ValueError(f"{season} {season_type} is missing team or opponent export")
        own, allowed = pair["team"], pair["opponent"]
        ids = set(own.index) & set(allowed.index)
        required_count = 30 if season_type == "regular" else 16
        if len(ids) < required_count:
            raise ValueError(f"{season} {season_type} has only {len(ids)} matching teams")
        for team_id in sorted(ids):
            off = own.loc[team_id]
            deff = allowed.loc[team_id]
            off_possessions = number(off, "offposs")
            def_possessions = number(deff, "defposs")
            if not off_possessions or not def_possessions or not number(off, "gamesplayed"):
                raise ValueError(f"invalid source denominator for team {team_id} ({season} {season_type})")
            records.append({
                "teamId": team_id,
                "season": season,
                "seasonType": season_type,
                "gamesPlayed": int(number(off, "gamesplayed") or 0),
                "offensiveRating": round(float(number(off, "points") or 0) / off_possessions * 100, 4),
                "defensiveRating": round(float(number(deff, "points") or 0) / def_possessions * 100, 4),
                "pace": number(off, "pace"),
                "effectiveFieldGoalPercentage": number(off, "efgpct"),
                "trueShootingPercentage": number(off, "tspct"),
                "updatedAt": snapshot.isoformat().replace("+00:00", "Z"),
            })

    keys = [(row["teamId"], row["season"], row["seasonType"]) for row in records]
    if len(keys) != len(set(keys)) or len(records) < 46:
        raise ValueError(f"incomplete or duplicate team stats records: {len(records)}")
    target = OUTPUT / "team-stats.json"
    staged = OUTPUT / ".team-stats.tmp"
    staged.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    staged.replace(target)

    manifest_path = OUTPUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    manifest.update({"teamStats": "team-stats.json", "teamStatsRecordCount": len(records), "teamStatsSourceUpdatedAt": snapshot.isoformat().replace("+00:00", "Z")})
    manifest["coverage"] = f"{manifest.get('coverage', 'NBA').split(' · Team stats', 1)[0]} · Team stats snapshot: {SNAPSHOT_AT[:10]}"
    if (datetime.now(timezone.utc) - snapshot).days > 30:
        manifest["status"] = "stale"
    manifest_stage = OUTPUT / ".manifest.tmp"
    manifest_stage.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    manifest_stage.replace(manifest_path)
    print(f"Imported {len(records)} verified NBA team season records ({len(ids)} teams in current final phase). Snapshot {SNAPSHOT_AT}.")


if __name__ == "__main__":
    main()
