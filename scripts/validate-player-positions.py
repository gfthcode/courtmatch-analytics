"""Validate position mapping IDs, enum values and duplicate identities."""
from __future__ import annotations
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'G', 'F', 'C', 'G-F', 'F-C', 'Unknown'}

def main() -> None:
    data = Path(os.environ.get('COURTMATCH_VALIDATION_DATA_DIR', ROOT / 'data'))
    players = json.loads((data / 'players.json').read_text(encoding='utf8'))
    ids = [str(player['id']) for player in players]
    assert len(ids) == len(set(ids)), 'duplicate player ids'
    assert all(player.get('position') in ALLOWED for player in players), 'invalid position value'
    mapping = json.loads((data / 'mappings/player-position-map.json').read_text(encoding='utf8'))
    assert set(mapping) == set(ids), 'position mapping does not cover player directory'
    for player in players:
        entry = mapping[player['id']]
        assert entry['position'] == player['position'], f"position map mismatch for {player['id']}"
        assert entry['position_verified'] == (player['position'] != 'Unknown'), f"position verification mismatch for {player['id']}"
    report = json.loads((data / 'reports/player-position-report.json').read_text(encoding='utf8'))
    unknown = sum(player['position'] == 'Unknown' for player in players)
    assert report['total_players'] == len(players), 'position report player count is stale'
    assert report['mapped_position_count'] == len(players) - unknown, 'position report mapped count is stale'
    assert report['unknown_count'] == unknown, 'position report unknown count is stale'
    assert report['mapping_success_rate'] == round((len(players) - unknown) / len(players) * 100, 2), 'position report rate is stale'
    print(f'Validated {len(ids)} player position records; mapped={len(ids)-unknown}, Unknown={unknown}.')

if __name__ == '__main__':
    main()
