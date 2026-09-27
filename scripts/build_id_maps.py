"""Validate official-ID mapping files without using display names as primary keys."""
from __future__ import annotations
import json, os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=Path(os.environ.get('COURTMATCH_ID_DATA_DIR', ROOT/'data'))
MAPPINGS=Path(os.environ.get('COURTMATCH_ID_MAPPINGS_DIR', DATA/'mappings'))

def load_rows(name:str)->list[dict]:
    value=json.loads((DATA/name).read_text(encoding='utf8'))
    if not isinstance(value,list) or not value:
        raise ValueError(f'Expected a non-empty array in {DATA/name}')
    return value

def build_team_id_map(teams:list[dict])->dict[str,str]:
    """The published team catalogue already carries verified NBA Stats IDs."""
    ids=[str(team.get('id','')).strip() for team in teams]
    abbreviations=[str(team.get('abbreviation','')).strip().upper() for team in teams]
    if any(not value.isdigit() for value in ids):
        raise ValueError('Every team must have a numeric official NBA ID')
    if len(set(ids))!=len(ids):
        raise ValueError('Duplicate official NBA team ID')
    if any(not value for value in abbreviations) or len(set(abbreviations))!=len(abbreviations):
        raise ValueError('Every team must have a unique abbreviation')
    return {team_id:team_id for team_id in ids}

def main():
    MAPPINGS.mkdir(parents=True,exist_ok=True)
    teams=load_rows('teams.json')
    players=load_rows('players.json')
    expected_player_ids={str(player.get('id','')).strip() for player in players}
    if '' in expected_player_ids or len(expected_player_ids)!=len(players):
        raise ValueError('Player catalogue contains empty or duplicate NBA IDs')
    expected_team_map=build_team_id_map(teams)
    for name in ('player-id-map.json','team-id-map.json'):
        path=MAPPINGS/name
        if not path.exists(): path.write_text('{}\n',encoding='utf8')
        value=json.loads(path.read_text(encoding='utf8'))
        if not isinstance(value,dict) or any(not str(key).strip() or not str(target).strip() for key,target in value.items()): raise ValueError(f'Invalid ID map: {path}')
        if name=='player-id-map.json':
            invalid={source:target for source,target in value.items() if str(target) not in expected_player_ids}
            if invalid: raise ValueError(f'Player ID map points outside the verified player catalogue: {list(invalid.items())[:5]}')
            missing=expected_player_ids-set(map(str,value.values()))
            if missing: raise ValueError(f'Player ID map is incomplete; missing {len(missing)} verified players')
        else:
            invalid={source:target for source,target in value.items() if str(target) not in set(expected_team_map.values())}
            if invalid: raise ValueError(f'Team ID map points outside the verified team catalogue: {list(invalid.items())[:5]}')
            # Current source IDs are already official NBA Stats IDs. Preserve any
            # explicit aliases while filling identity entries for canonical IDs.
            for source,target in expected_team_map.items(): value.setdefault(source,target)
            missing=set(expected_team_map.values())-set(map(str,value.values()))
            if missing: raise ValueError(f'Team ID map is incomplete; missing {len(missing)} NBA teams')
            path.write_text(json.dumps(value,indent=2)+'\n',encoding='utf8')
    print('ID maps validated; empty maps are not sufficient to publish Live Data.')

if __name__=='__main__': main()
