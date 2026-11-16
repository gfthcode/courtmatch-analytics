"""Import current NBA regular-season player/team totals from PBPStats.

This pipeline is intentionally separate from the verified historical NBA Stats
API and matchup catalogue. It only adds 2026-27 season rows and never rewrites
historical matchup or game-log records.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("COURTMATCH_PUBLISHED_DATA_DIR", ROOT / "data"))
SEASON = "2026-27"
API = "https://api.pbpstats.com/get-totals/nba?Season=2026-27&SeasonType=Regular%2BSeason&StartType=All&Type={}"
TEAM_NAMES = {
    "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", "CHA": "Charlotte Hornets",
    "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers", "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets",
    "DET": "Detroit Pistons", "GSW": "Golden State Warriors", "HOU": "Houston Rockets", "IND": "Indiana Pacers",
    "LAC": "LA Clippers", "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies", "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves", "NOP": "New Orleans Pelicans", "NYK": "New York Knicks",
    "OKC": "Oklahoma City Thunder", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers", "PHX": "Phoenix Suns",
    "POR": "Portland Trail Blazers", "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs", "TOR": "Toronto Raptors",
    "UTA": "Utah Jazz", "WAS": "Washington Wizards",
}


def number(row: dict, key: str, default: float = 0) -> float:
    value = row.get(key)
    try:
        parsed = float(value)
        return parsed if parsed == parsed and abs(parsed) != float("inf") else default
    except (TypeError, ValueError):
        return default


def ratio(numerator: float, denominator: float) -> float | None:
    return numerator / denominator if denominator > 0 else None


def fetch_rows(kind: str) -> list[dict]:
    request = Request(API.format(kind), headers={
        "Accept": "application/json",
        "Origin": "https://www.pbpstats.com",
        "Referer": "https://www.pbpstats.com/",
        "User-Agent": "CourtMatch-Analytics/2.0 (+https://gfthcode.github.io/courtmatch-analytics/)",
    })
    try:
        with urlopen(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"PBPStats {kind} refresh failed: {error}") from error
    rows = payload.get("multi_row_table_data")
    if not isinstance(rows, list) or not rows:
        raise RuntimeError(f"PBPStats {kind} returned no rows")
    return rows


def player_record(row: dict, updated_at: str) -> dict:
    games = number(row, "GamesPlayed")
    fg2m, fg2a = number(row, "FG2M"), number(row, "FG2A")
    fg3m, fg3a = number(row, "FG3M"), number(row, "FG3A")
    fgm, fga = fg2m + fg3m, fg2a + fg3a
    ftm, fta = number(row, "FtPoints"), number(row, "FTA")
    return {
        "playerId": str(row.get("EntityId", "")),
        "playerName": str(row.get("Name", "")).strip(),
        "season": SEASON,
        "seasonType": "regular",
        "teamId": str(row.get("TeamId", "")),
        "teamAbbreviation": str(row.get("TeamAbbreviation", "")).upper(),
        "gamesPlayed": games,
        "minutesPerGame": ratio(number(row, "Minutes"), games) or 0,
        "pointsPerGame": ratio(number(row, "Points"), games) or 0,
        "reboundsPerGame": ratio(number(row, "Rebounds"), games) or 0,
        "offensiveReboundsPerGame": ratio(number(row, "OffRebounds"), games) or 0,
        "defensiveReboundsPerGame": ratio(number(row, "DefRebounds"), games) or 0,
        "assistsPerGame": ratio(number(row, "Assists"), games) or 0,
        "stealsPerGame": ratio(number(row, "Steals"), games) or 0,
        "blocksPerGame": ratio(number(row, "Blocks"), games) or 0,
        "turnoversPerGame": ratio(number(row, "Turnovers"), games) or 0,
        "personalFoulsPerGame": ratio(number(row, "Fouls"), games) or 0,
        "fieldGoalsMadePerGame": ratio(fgm, games) or 0,
        "fieldGoalsAttemptedPerGame": ratio(fga, games) or 0,
        "fieldGoalPercentage": ratio(fgm, fga),
        "threePointersMadePerGame": ratio(fg3m, games) or 0,
        "threePointersAttemptedPerGame": ratio(fg3a, games) or 0,
        "threePointPercentage": ratio(fg3m, fg3a),
        "freeThrowsMadePerGame": ratio(ftm, games) or 0,
        "freeThrowsAttemptedPerGame": ratio(fta, games) or 0,
        "freeThrowPercentage": ratio(ftm, fta),
        "plusMinusPerGame": ratio(number(row, "PlusMinus"), games) or 0,
        "trueShootingPercentage": row.get("TsPct"),
        "effectiveFieldGoalPercentage": row.get("EfgPct"),
        "usagePercentage": ratio(number(row, "Usage"), 100),
        "pointsTotal": number(row, "Points"),
        "reboundsTotal": number(row, "Rebounds"),
        "assistsTotal": number(row, "Assists"),
        "threePointersMadeTotal": fg3m,
        "updatedAt": updated_at,
    }


def team_record(row: dict, updated_at: str) -> dict:
    games = number(row, "GamesPlayed")
    return {
        "teamId": str(row.get("TeamId", "")),
        "season": SEASON,
        "seasonType": "regular",
        "gamesPlayed": games,
        "offensiveRating": ratio(number(row, "Points"), number(row, "OffPoss")) * 100 if number(row, "OffPoss") else None,
        "defensiveRating": ratio(number(row, "OpponentPoints"), number(row, "DefPoss")) * 100 if number(row, "DefPoss") else None,
        "pace": row.get("Pace"),
        "effectiveFieldGoalPercentage": row.get("EfgPct"),
        "trueShootingPercentage": row.get("TsPct"),
        "updatedAt": updated_at,
    }


def main() -> None:
    players_raw = fetch_rows("Player")
    teams_raw = fetch_rows("Team")
    now = datetime.now(timezone.utc).isoformat()
    teams = json.loads((DATA / "teams.json").read_text(encoding="utf8"))
    team_ids = {str(team["id"]) for team in teams}
    player_rows = [player_record(row, now) for row in players_raw]
    team_rows = [team_record(row, now) for row in teams_raw]

    if len(player_rows) < 250 or len({row["playerId"] for row in player_rows}) != len(player_rows):
        raise RuntimeError(f"PBPStats returned an implausible or duplicate player sample: {len(player_rows)}")
    if any(not row["playerId"].isdigit() or not row["playerName"] or row["teamId"] not in team_ids or row["gamesPlayed"] <= 0 for row in player_rows):
        raise RuntimeError("PBPStats player rows failed identity, team, or sample validation")
    if len(team_rows) != 30 or {row["teamId"] for row in team_rows} != team_ids or any(row["gamesPlayed"] <= 0 for row in team_rows):
        raise RuntimeError("PBPStats team rows failed 30-team identity or game-count validation")

    player_stats_path = DATA / "player-stats.json"
    old_player_stats = json.loads(player_stats_path.read_text(encoding="utf8"))
    combined_stats = [row for row in old_player_stats if row.get("season") != SEASON]
    combined_stats.extend(player_rows)
    team_stats_path = DATA / "team-stats.json"
    old_team_stats = json.loads(team_stats_path.read_text(encoding="utf8"))
    combined_team_stats = [row for row in old_team_stats if row.get("season") != SEASON]
    combined_team_stats.extend(team_rows)

    manifest_path = DATA / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    manifest["playerStatsSource"] = "PBPStats"
    manifest["playerStatsSeason"] = SEASON
    manifest["playerStatsSeasonSourceUpdatedAt"] = now
    manifest["playerStatsRecordCount"] = len(player_rows)
    manifest["teamStatsSource"] = "PBPStats"
    manifest["teamStatsSeason"] = SEASON
    manifest["teamStatsSeasonSourceUpdatedAt"] = now
    manifest["teamStatsRecordCount"] = len(combined_team_stats)
    manifest["seasonRefreshMode"] = "live"
    manifest["seasonDataVersion"] = f"{SEASON.lower()}-pbpstats-{now[:10]}"
    manifest["seasonDataSources"] = {
        SEASON: {
            "provider": "PBPStats",
            "updatedAt": now,
            "playerRows": len(player_rows),
            "teamRows": len(team_rows),
            "seasonType": "regular",
        }
    }
    coverage = manifest.get("coverage", "").split(" · 2026-27 NBA regular-season player and team totals from PBPStats")[0]
    manifest["coverage"] = f"{coverage} · {SEASON} NBA regular-season player and team totals from PBPStats"

    player_stats_path.write_text(json.dumps(combined_stats, separators=(",", ":")), encoding="utf8")
    team_stats_path.write_text(json.dumps(combined_team_stats, separators=(",", ":")), encoding="utf8")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    summary = {"season": SEASON, "source": "PBPStats", "sourceUpdatedAt": now, "playerCount": len(player_rows), "teamCount": len(team_rows)}
    print(json.dumps(summary))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise
