"""Validate position mapping IDs, enum values and duplicate identities."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'G', 'F', 'C', 'G-F', 'F-C', 'Unknown'}

def main() -> None:
    players = json.loads((ROOT / 'public/data/players.json').read_text(encoding='utf8'))
    ids = [str(player['id']) for player in players]
    assert len(ids) == len(set(ids)), 'duplicate player ids'
    assert all(player.get('position') in ALLOWED for player in players), 'invalid position value'
    mapping = json.loads((ROOT / 'data/mappings/player-position-map.json').read_text(encoding='utf8'))
    assert set(mapping) == set(ids), 'position mapping does not cover player directory'
    print(f'Validated {len(ids)} player position records; Unknown={sum(p["position"] == "Unknown" for p in mapping.values())}.')

if __name__ == '__main__':
    main()
