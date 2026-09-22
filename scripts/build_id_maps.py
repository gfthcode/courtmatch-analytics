"""Validate official-ID mapping files without using display names as primary keys."""
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MAPPINGS=ROOT/'data'/'mappings'

def main():
    MAPPINGS.mkdir(parents=True,exist_ok=True)
    for name in ('player-id-map.json','team-id-map.json'):
        path=MAPPINGS/name
        if not path.exists(): path.write_text('{}\n',encoding='utf8')
        value=json.loads(path.read_text(encoding='utf8'))
        if not isinstance(value,dict) or any(not str(key).strip() or not str(target).strip() for key,target in value.items()): raise ValueError(f'Invalid ID map: {path}')
    print('ID maps validated; empty maps are not sufficient to publish Live Data.')

if __name__=='__main__': main()
