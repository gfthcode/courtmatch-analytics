"""Fetch auditable 2025-26 NBA season averages and per-game logs from NBA Stats.

Outputs are staged under data/processed and only published by sync_data.py after
the complete browser dataset passes validation.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from nba_api_retry import retry_nba_request

SEASON = os.environ.get('COURTMATCH_SEASON', '2025-26')
PLAYERS = Path(os.environ.get('COURTMATCH_PLAYER_DIRECTORY', ROOT / 'data/processed/players-candidate.json'))
OUTPUT = ROOT / 'data/processed'


def val(row: dict, key: str, default: float = 0) -> float:
    value = row.get(key)
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def pct(row: dict, key: str) -> float | None:
    value = row.get(key)
    return float(value) if value is not None else None


def endpoint_rows(endpoint) -> list[dict]:
    result = endpoint.get_dict()['resultSets'][0]
    return [dict(zip(result['headers'], row)) for row in result['rowSet']]


def fetch_stats(player_ids: set[str], season_type: str, now: str) -> list[dict]:
    from nba_api.stats.endpoints import leaguedashplayerstats

    base = retry_nba_request(lambda: endpoint_rows(leaguedashplayerstats.LeagueDashPlayerStats(
        season=SEASON, season_type_all_star=season_type,
        measure_type_detailed_defense='Base', per_mode_detailed='PerGame', timeout=90,
    )), label=f'LeagueDashPlayerStats(Base, {season_type})')
    time.sleep(1)
    advanced = retry_nba_request(lambda: endpoint_rows(leaguedashplayerstats.LeagueDashPlayerStats(
        season=SEASON, season_type_all_star=season_type,
        measure_type_detailed_defense='Advanced', per_mode_detailed='PerGame', timeout=90,
    )), label=f'LeagueDashPlayerStats(Advanced, {season_type})')
    adv_by_id = {str(row['PLAYER_ID']): row for row in advanced}
    season_type_code = 'regular' if season_type == 'Regular Season' else 'playoffs'
    rows = []
    for row in base:
        player_id = str(row['PLAYER_ID'])
        if player_id not in player_ids:
            continue
        adv = adv_by_id.get(player_id, {})
        rows.append({
            'playerId': player_id, 'season': SEASON, 'seasonType': season_type_code,
            'teamId': str(row['TEAM_ID']), 'teamAbbreviation': str(row['TEAM_ABBREVIATION']),
            'gamesPlayed': int(val(row, 'GP')), 'minutesPerGame': val(row, 'MIN'),
            'pointsPerGame': val(row, 'PTS'), 'reboundsPerGame': val(row, 'REB'),
            'offensiveReboundsPerGame': val(row, 'OREB'), 'defensiveReboundsPerGame': val(row, 'DREB'),
            'assistsPerGame': val(row, 'AST'), 'stealsPerGame': val(row, 'STL'),
            'blocksPerGame': val(row, 'BLK'), 'turnoversPerGame': val(row, 'TOV'),
            'personalFoulsPerGame': val(row, 'PF'), 'fieldGoalsMadePerGame': val(row, 'FGM'),
            'fieldGoalsAttemptedPerGame': val(row, 'FGA'), 'fieldGoalPercentage': pct(row, 'FG_PCT'),
            'threePointersMadePerGame': val(row, 'FG3M'), 'threePointersAttemptedPerGame': val(row, 'FG3A'),
            'threePointPercentage': pct(row, 'FG3_PCT'), 'freeThrowsMadePerGame': val(row, 'FTM'),
            'freeThrowsAttemptedPerGame': val(row, 'FTA'), 'freeThrowPercentage': pct(row, 'FT_PCT'),
            'plusMinusPerGame': val(row, 'PLUS_MINUS'),
            'trueShootingPercentage': pct(adv, 'TS_PCT'), 'effectiveFieldGoalPercentage': pct(adv, 'EFG_PCT'),
            'usagePercentage': pct(adv, 'USG_PCT'), 'offensiveRating': pct(adv, 'OFF_RATING'),
            'defensiveRating': pct(adv, 'DEF_RATING'), 'netRating': pct(adv, 'NET_RATING'),
            'pace': pct(adv, 'PACE'), 'playerImpactEstimate': pct(adv, 'PIE'),
            'updatedAt': now,
        })
    return rows


def fetch_logs(player_ids: set[str], season_type: str, now: str) -> list[dict]:
    from nba_api.stats.endpoints import leaguegamelog

    raw = retry_nba_request(lambda: endpoint_rows(leaguegamelog.LeagueGameLog(
        season=SEASON, season_type_all_star=season_type,
        player_or_team_abbreviation='P', timeout=120,
    )), label=f'LeagueGameLog({season_type})')
    code = 'regular' if season_type == 'Regular Season' else 'playoffs'
    rows = []
    for row in raw:
        player_id = str(row['PLAYER_ID'])
        if player_id not in player_ids:
            continue
        matchup = str(row['MATCHUP'])
        opponent = matchup.replace(' vs. ', ' @ ').split(' @ ')[-1].strip()
        rows.append({
            'id': f"{SEASON}-{code}-{row['GAME_ID']}-{player_id}",
            'playerId': player_id, 'season': SEASON, 'seasonType': code,
            'gameId': str(row['GAME_ID']), 'date': str(row['GAME_DATE'])[:10],
            'teamId': str(row['TEAM_ID']), 'teamAbbreviation': str(row['TEAM_ABBREVIATION']),
            'opponent': opponent, 'matchup': matchup, 'result': str(row['WL'] or ''),
            'minutes': val(row, 'MIN'), 'points': val(row, 'PTS'), 'rebounds': val(row, 'REB'),
            'offensiveRebounds': val(row, 'OREB'), 'defensiveRebounds': val(row, 'DREB'),
            'assists': val(row, 'AST'), 'steals': val(row, 'STL'), 'blocks': val(row, 'BLK'),
            'turnovers': val(row, 'TOV'), 'personalFouls': val(row, 'PF'),
            'fieldGoalsMade': val(row, 'FGM'), 'fieldGoalsAttempted': val(row, 'FGA'),
            'fieldGoalPercentage': pct(row, 'FG_PCT'), 'threePointersMade': val(row, 'FG3M'),
            'threePointersAttempted': val(row, 'FG3A'), 'threePointPercentage': pct(row, 'FG3_PCT'),
            'freeThrowsMade': val(row, 'FTM'), 'freeThrowsAttempted': val(row, 'FTA'),
            'freeThrowPercentage': pct(row, 'FT_PCT'), 'plusMinus': val(row, 'PLUS_MINUS'),
            'updatedAt': now,
        })
    return rows


def main() -> None:
    players = json.loads(PLAYERS.read_text(encoding='utf8'))
    player_ids = {str(row['id']) for row in players}
    now = datetime.now(timezone.utc).isoformat()
    stats, logs = [], []
    for index, season_type in enumerate(('Regular Season', 'Playoffs')):
        stats.extend(fetch_stats(player_ids, season_type, now))
        logs.extend(fetch_logs(player_ids, season_type, now))
        if index == 0:
            time.sleep(1)
    if len(stats) < len(player_ids) * 0.5:
        raise RuntimeError(f'NBA Stats player averages unexpectedly incomplete: {len(stats)} rows for {len(player_ids)} players')
    if not logs:
        raise RuntimeError('NBA Stats returned no player game logs; refusing to publish an empty daily module')
    logs.sort(key=lambda row: (row['date'], row['gameId'], row['playerId']), reverse=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'nba-player-stats.json').write_text(json.dumps(stats, separators=(',', ':')), encoding='utf8')
    (OUTPUT / 'nba-daily.json').write_text(json.dumps(logs, separators=(',', ':')), encoding='utf8')
    report = {
        'source': 'NBA Stats API LeagueDashPlayerStats + LeagueGameLog', 'season': SEASON,
        'playerStatsCount': len(stats), 'dailyLogCount': len(logs),
        'firstGameDate': min(row['date'] for row in logs), 'lastGameDate': max(row['date'] for row in logs),
        'generatedAt': now,
    }
    (ROOT / 'data/reports/nba-api-data-report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
