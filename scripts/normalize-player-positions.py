"""Normalize auditable player positions without inventing a default position."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'G', 'F', 'C', 'G-F', 'F-C', 'Unknown'}

def main() -> None:
    source = ROOT / 'data' / 'processed' / 'players-candidate.json'
    mapping_dir = ROOT / 'data' / 'mappings'
    report_dir = ROOT / 'data' / 'reports'
    mapping_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    players = json.loads(source.read_text(encoding='utf8')) if source.exists() else json.loads((ROOT / 'public/data/players.json').read_text(encoding='utf8'))
    mapping = {}
    invalid = []
    for player in players:
        position = player.get('position', 'Unknown')
        if player.get('verification') == 'position-unverified' or not player.get('position_verified', False):
            position = 'Unknown'
        if position not in ALLOWED:
            invalid.append({'player_id': str(player.get('id', '')), 'value': position})
            position = 'Unknown'
        mapping[str(player['id'])] = {'player_id': str(player['id']), 'position': position, 'position_source': 'source-or-unverified', 'position_verified': position != 'Unknown', 'updated_at': player.get('updatedAt', '')[:10]}
    (mapping_dir / 'player-position-map.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf8')
    unknown = [row['player_id'] for row in mapping.values() if row['position'] == 'Unknown']
    counts = {position: sum(row['position'] == position for row in mapping.values()) for position in sorted(ALLOWED)}
    report = {'total_players': len(mapping), 'mapped_position_count': len(mapping) - len(unknown), 'unknown_count': len(unknown), 'mapping_success_rate': round((len(mapping)-len(unknown))/len(mapping)*100, 2) if mapping else 0, 'unknown_player_ids': unknown, 'invalid_positions': invalid, 'position_distribution': counts, 'source': 'NBA official roster position when available; Unknown is retained when not verifiable'}
    (report_dir / 'player-position-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'total_players': report['total_players'], 'unknown_count': report['unknown_count'], 'invalid_positions': len(invalid)}))

if __name__ == '__main__':
    main()
