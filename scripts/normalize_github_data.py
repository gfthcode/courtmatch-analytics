"""Create browser-safe CourtMatch JSON from suren504/surennba_stats exports.

This program is intentionally fail-closed. It never parses XLSX in the browser and
does not overwrite the published manifest until every output has been validated.
Provide a normalized player directory (JSON) so raw NBA ids can be joined to names.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlretrieve

ROOT = Path(__file__).resolve().parents[1]
# GitHub Pages serves the repository root. Publishing anywhere else would leave
# the client reading an old catalogue, so the validated staging swap targets data/.
PUBLISHED = ROOT / "data"
MATCHUPS_URL = os.environ.get("COURTMATCH_MATCHUP_SOURCE", "https://raw.githubusercontent.com/suren504/surennba_stats/main/data/matchups/2025-26NBA_Regular_Matchups.xlsx")
PLAYTYPES_URL = os.environ.get("COURTMATCH_PLAYTYPE_SOURCE", "https://raw.githubusercontent.com/suren504/surennba_stats/main/data/2025-26_player_playtype.xlsx")
PLAYER_DIRECTORY = os.environ.get("COURTMATCH_PLAYER_DIRECTORY", "")
SEASON = os.environ.get("COURTMATCH_SEASON", "2025-26")


def download(source: str, destination: Path) -> Path:
    if source.startswith(("http://", "https://")):
        urlretrieve(source, destination)
        return destination
    path = Path(source)
    if not path.is_file():
        raise FileNotFoundError(f"Source not found: {source}")
    return path


def value(row, *names, default=0):
    for name in names:
        if name in row and row[name] is not None:
            try:
                return float(row[name])
            except (TypeError, ValueError):
                return default
    return default


def text(row, *names) -> str:
    for name in names:
        if name in row and row[name] is not None:
            candidate = str(row[name]).strip()
            if candidate and candidate.lower() != "nan":
                return candidate.split(".")[0] if candidate.replace(".", "", 1).isdigit() else candidate
    return ""


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf8")


def load_players(source: str) -> list[dict]:
    if not source:
        raise RuntimeError("COURTMATCH_PLAYER_DIRECTORY is required; refusing to publish unmatched player ids")
    source_path = download(source, Path(tempfile.mkdtemp()) / "players.json")
    payload = json.loads(source_path.read_text(encoding="utf8"))
    if not isinstance(payload, list) or not payload:
        raise ValueError("Player directory must be a non-empty JSON array")
    required = {"id", "name", "chineseName", "teamId", "teamName", "teamAbbreviation", "position"}
    for player in payload:
        if not required.issubset(player):
            raise ValueError(f"Player directory record missing: {sorted(required-set(player))}")
        player.update({"id": str(player["id"]), "aliases": player.get("aliases", []), "shortName": player.get("shortName", player["name"]), "height": str(player.get("height", "")), "weight": float(player.get("weight", 0)), "jerseyNumber": str(player.get("jerseyNumber", "")), "headshotUrl": player.get("headshotUrl", ""), "league": "NBA"})
    return payload


def normalize_matchups(frame, player_ids: set[str], now: str) -> list[dict]:
    records = []
    for index, row in enumerate(frame.to_dict("records")):
        off = text(row, "personIdOff", "OFF_PLAYER_ID", "OFF_PLAYER_ID", "offensivePlayerId")
        defender = text(row, "personIdDef", "DEF_PLAYER_ID", "defensivePlayerId")
        possessions = value(row, "partialPossessions", "MATCHUP_POSS", "matchupPossessions", "possessions")
        if not off or not defender or off not in player_ids or defender not in player_ids or possessions <= 0:
            continue
        records.append({"id": f"{SEASON}-regular-{index}-{off}-{defender}", "offensivePlayerId": off, "defensivePlayerId": defender, "season": SEASON, "seasonType": "regular", "league": "NBA", "matchupPossessions": round(possessions, 2), "points": value(row, "playerPoints", "PTS", "points"), "fieldGoalAttempts": value(row, "fieldGoalsAttempted", "FGA", "fieldGoalAttempts"), "fieldGoalsMade": value(row, "fieldGoalsMade", "FGM"), "threePointAttempts": value(row, "threePointersAttempted", "FG3A", "threePointAttempts"), "threePointMade": value(row, "threePointersMade", "FG3M", "threePointMade"), "freeThrowAttempts": value(row, "freeThrowsAttempted", "FTA", "freeThrowAttempts"), "freeThrowsMade": value(row, "freeThrowsMade", "FTM", "freeThrowsMade"), "turnovers": value(row, "turnovers", "TOV"), "updatedAt": now})
    if len(records) < 500:
        raise ValueError("Refusing to publish fewer than 500 joined matchup records")
    return records


def normalize_playtypes(frame, player_ids: set[str], now: str) -> list[dict]:
    allowed = {"Isolation", "Transition", "PRBallHandler", "PRRollman", "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"}
    records = []
    for row in frame.to_dict("records"):
        player_id = text(row, "personId", "PERSON_ID", "playerId")
        play_type = text(row, "playType", "PLAY_TYPE", "play_type")
        possessions = value(row, "possessions", "POSS")
        if player_id not in player_ids or play_type not in allowed or possessions <= 0:
            continue
        ppp = value(row, "pointsPerPossession", "PPP", default=None)
        records.append({"playerId": player_id, "playType": play_type, "grouping": "offensive", "possessions": round(possessions, 2), "pointsPerPossession": ppp, "percentile": None, "season": SEASON, "seasonType": "regular", "updatedAt": now})
    return records


def main() -> None:
    import pandas as pd
    now = datetime.now(timezone.utc).isoformat()
    with tempfile.TemporaryDirectory() as work:
        work_path = Path(work)
        players = load_players(PLAYER_DIRECTORY)
        player_ids = {player["id"] for player in players}
        matchups = normalize_matchups(pd.read_excel(download(MATCHUPS_URL, work_path / "matchups.xlsx")), player_ids, now)
        playtypes = normalize_playtypes(pd.read_excel(download(PLAYTYPES_URL, work_path / "playtypes.xlsx")), player_ids, now)
        teams = list({player["teamId"]: {"id": player["teamId"], "name": player["teamName"], "chineseName": player["teamName"], "abbreviation": player["teamAbbreviation"], "logoUrl": ""} for player in players}.values())
        manifest = {"provider": "github-json", "status": "live", "league": "NBA", "lastUpdated": now, "version": f"{SEASON}-{datetime.now(timezone.utc).strftime('%Y%m%d')}", "coverage": f"{SEASON} NBA regular season", "players": "players.json", "teams": "teams.json", "matchups": "matchups.json", "playtypes": "playtypes.json", "playerCount": len(players), "matchupRecordCount": len(matchups), "playtypeRecordCount": len(playtypes), "isDemo": False}
        stage = work_path / "stage"; stage.mkdir()
        for name, payload in (("players.json", players), ("teams.json", teams), ("matchups.json", matchups), ("playtypes.json", playtypes)):
            write_json(stage / name, payload)
        write_json(stage / "manifest.json", manifest)
        # Data files first, manifest last: clients observe either the old complete dataset or the new complete dataset.
        PUBLISHED.mkdir(parents=True, exist_ok=True)
        for name in ("players.json", "teams.json", "matchups.json", "playtypes.json", "manifest.json"):
            shutil.move(str(stage / name), str(PUBLISHED / name))
    print(f"Published {len(matchups)} NBA matchup rows and {len(playtypes)} play-type rows")


if __name__ == "__main__":
    main()
