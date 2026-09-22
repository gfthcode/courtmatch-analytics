"""Normalize publicly licensed source exports into CourtMatch JSON.

This is deliberately fail-closed: a partial download or an unexpected source schema
raises before any existing public data file is replaced.
"""
from __future__ import annotations
import json, os, tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlretrieve

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'
SOURCE=os.environ.get('COURTMATCH_MATCHUP_SOURCE','https://raw.githubusercontent.com/suren504/surennba_stats/main/data/matchups/2025-26NBA_Regular_Matchups.xlsx')

def main():
    import pandas as pd
    with tempfile.TemporaryDirectory() as tmp:
        raw=Path(tmp)/'matchups.xlsx';urlretrieve(SOURCE,raw)
        frame=pd.read_excel(raw)
    required={'OFF_PLAYER_ID','DEF_PLAYER_ID','MATCHUP_MIN','PTS'}
    missing=required-set(frame.columns)
    if missing: raise ValueError(f'Unsupported matchup source schema; missing {sorted(missing)}')
    # Source naming varies by season; keeping this mapping explicit makes schema drift visible.
    records=[]
    for index,row in frame.iterrows():
        possessions=float(row.get('MATCHUP_MIN',0))*2.1
        if possessions<=0: continue
        records.append({'id':f'github-{index}','offensivePlayerId':str(int(row.OFF_PLAYER_ID)),'defensivePlayerId':str(int(row.DEF_PLAYER_ID)),'season':'2025-26','seasonType':'regular','league':'NBA','matchupPossessions':round(possessions),'points':float(row.PTS),'fieldGoalAttempts':float(row.get('FGA',0)),'fieldGoalsMade':float(row.get('FGM',0)),'threePointAttempts':float(row.get('FG3A',0)),'threePointMade':float(row.get('FG3M',0)),'freeThrowAttempts':float(row.get('FTA',0)),'freeThrowsMade':float(row.get('FTM',0)),'turnovers':float(row.get('TOV',0)),'updatedAt':datetime.now(timezone.utc).isoformat()})
    if len(records)<500: raise ValueError('Refusing to publish an unexpectedly small matchup dataset')
    # Player identity enrichment is a separate, explicit stage. Do not publish records that
    # cannot be joined to a player directory in the same run.
    raise RuntimeError('Player metadata normalization must be configured before publishing live data')

if __name__=='__main__': main()
