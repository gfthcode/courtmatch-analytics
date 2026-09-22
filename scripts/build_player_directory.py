"""Build an auditable NBA player-directory candidate without name-based IDs.

Reference player_stats supplies entityid/teamid/name. nba_api static players, when
available, verifies that entityid is an official NBA player id. Candidate output is
not publishable as Live until all required IDs are verified.
"""
from __future__ import annotations
import csv, json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
CSV_URL=os.environ.get('COURTMATCH_PLAYER_STATS_SOURCE','https://raw.githubusercontent.com/suren504/surennba_stats/main/data/player_stats/2025-26NBA_RegularSeason_Player_stats.csv')

def normalise(name:str)->str:return re.sub(r'[^a-z0-9]+',' ',name.lower()).strip()
def main():
    try:
        official={str(row['id']):row for row in __import__('nba_api.stats.static.players',fromlist=['players']).get_players()}
        official_available=True
    except Exception:
        official={};official_available=False
    if CSV_URL.startswith(('http://','https://')):
        with urlopen(CSV_URL,timeout=30) as response: rows=list(csv.DictReader(line.decode('utf8-sig') for line in response))
    else:
        with open(CSV_URL,encoding='utf-8-sig',newline='') as source: rows=list(csv.DictReader(source))
    candidates=[]; conflicts=[]; seen=set(); now=datetime.now(timezone.utc).isoformat()
    for row in rows:
        player_id=str(row.get('entityid','')).strip();name=(row.get('name') or '').strip()
        if not player_id or not name: conflicts.append({'reason':'missing-id-or-name','row':row});continue
        if player_id in seen: conflicts.append({'reason':'duplicate-player-id','id':player_id,'name':name});continue
        seen.add(player_id); official_row=official.get(player_id);verified=official_row is not None
        if verified and normalise(official_row['full_name'])!=normalise(name):conflicts.append({'reason':'official-name-mismatch','id':player_id,'referenceName':name,'officialName':official_row['full_name']})
        candidates.append({'id':player_id,'name':name,'normalizedName':normalise(name),'chineseName':name,'aliases':[row.get('shortname','')], 'shortName':row.get('shortname') or name,'teamId':str(row.get('teamid','')),'teamName':row.get('teamabbreviation') or 'Unknown','teamAbbreviation':row.get('teamabbreviation') or 'UNK','position':'G-F','height':'','weight':0,'jerseyNumber':'','headshotUrl':'','league':'NBA','source':'nba-api+reference-data' if verified else 'reference-player-stats','verified':verified,'updatedAt':now})
    processed=ROOT/'data'/'processed';reports=ROOT/'data'/'reports';mappings=ROOT/'data'/'mappings';processed.mkdir(parents=True,exist_ok=True);reports.mkdir(parents=True,exist_ok=True);mappings.mkdir(parents=True,exist_ok=True)
    (processed/'players-candidate.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2),encoding='utf8')
    (mappings/'player-id-map.json').write_text(json.dumps({p['id']:p['id'] for p in candidates},indent=2),encoding='utf8')
    report={'source':'player_stats CSV + nba_api.stats.static.players','officialDirectoryAvailable':official_available,'candidateCount':len(candidates),'verifiedCount':sum(p['verified'] for p in candidates),'unverifiedCount':sum(not p['verified'] for p in candidates),'conflictCount':len(conflicts),'generatedAt':now}
    (reports/'player-directory-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    (reports/'unmapped_players.json').write_text(json.dumps(conflicts,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(report))
    return report
if __name__=='__main__':main()
