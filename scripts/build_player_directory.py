"""Build an auditable NBA player-directory candidate without name-based IDs.

Reference player_stats supplies entityid/teamid/name. nba_api static players, when
available, verifies that entityid is an official NBA player id. Candidate output is
not publishable as Live until all required IDs are verified.
"""
from __future__ import annotations
import csv, json, os, re, ssl, sys, time, unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
from nba_api_retry import retry_nba_request

CSV_URL=os.environ.get('COURTMATCH_PLAYER_STATS_SOURCE','https://raw.githubusercontent.com/suren504/surennba_stats/main/data/player_stats/2025-26NBA_RegularSeason_Player_stats.csv')
SEASON=os.environ.get('COURTMATCH_SEASON','2025-26')

def normalise(name:str)->str:
    plain=''.join(c for c in unicodedata.normalize('NFKD',name) if not unicodedata.combining(c))
    tokens=re.sub(r'[^a-z0-9]+',' ',plain.lower()).split()
    if tokens and tokens[-1] in {'jr','sr','ii','iii','iv'}: tokens=tokens[:-1]
    return ' '.join(tokens)
def trusted_context():
    """Use certifi for the Python.org runtime, whose system CA path can be empty."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()
def main():
    from nba_api.stats.endpoints import commonallplayers, commonteamroster, commonplayerinfo
    all_rows=retry_nba_request(lambda:commonallplayers.CommonAllPlayers(is_only_current_season=1,season=SEASON,timeout=60).get_dict()['resultSets'][0],label='CommonAllPlayers')
    official={str(row[0]):{'name':row[2],'teamId':str(row[8])} for row in all_rows['rowSet']}
    official_available=bool(official)
    if CSV_URL.startswith(('http://','https://')):
        with urlopen(CSV_URL,timeout=30,context=trusted_context()) as response: rows=list(csv.DictReader(line.decode('utf-8-sig') for line in response))
    else:
        with open(CSV_URL,encoding='utf-8-sig',newline='') as source: rows=list(csv.DictReader(source))
    candidates=[]; conflicts=[]; seen=set(); now=datetime.now(timezone.utc).isoformat()
    # NBA Stats roster endpoints are the source of position/height/weight/number;
    # they are deliberately kept separate from the official-ID identity check.
    positions={}
    teams={str(row['teamid']) for row in rows if row.get('teamid')}
    for index,team_id in enumerate(sorted(teams)):
        try:
            roster=retry_nba_request(lambda:commonteamroster.CommonTeamRoster(team_id=team_id,season=SEASON,timeout=60).get_dict()['resultSets'][0],label=f'CommonTeamRoster({team_id})')
            for roster_row in roster['rowSet']:
                positions[str(roster_row[14])]={'position':str(roster_row[7]).strip(),'height':str(roster_row[8] or ''),'weight':float(roster_row[9] or 0),'jerseyNumber':str(roster_row[6] or '')}
        except Exception as error:
            print(f'NBA Stats roster unavailable for {team_id}: {error}',file=sys.stderr)
        if index+1<len(teams): time.sleep(0.75)
    for row in rows:
        player_id=str(row.get('entityid','')).strip();name=(row.get('name') or '').strip()
        if not player_id or not name: conflicts.append({'reason':'missing-id-or-name','row':row});continue
        if player_id in seen: conflicts.append({'reason':'duplicate-player-id','id':player_id,'name':name});continue
        seen.add(player_id); official_row=official.get(player_id);verified=official_row is not None
        if not verified:
            conflicts.append({'reason':'official-id-not-found','id':player_id,'referenceName':name});continue
        if normalise(official_row['name'])!=normalise(name):conflicts.append({'reason':'official-name-mismatch','id':player_id,'referenceName':name,'officialName':official_row['name']})
        # The immutable source entity ID is checked against NBA Stats by ID. Display
        # names are canonicalized from NBA Stats, not used to invent identity.
        roster=positions.get(player_id,{})
        raw_position=roster.get('position','Unknown')
        position={'F-G':'G-F','C-F':'F-C'}.get(raw_position,raw_position)
        if position not in {'G','F','C','G-F','F-C'}: position='Unknown'
        candidates.append({'id':player_id,'name':official_row['name'],'normalizedName':normalise(official_row['name']),'chineseName':official_row['name'],'aliases':[name,row.get('shortname','')], 'shortName':row.get('shortname') or official_row['name'],'teamId':str(row.get('teamid','')),'teamName':row.get('teamabbreviation') or 'Unknown','teamAbbreviation':row.get('teamabbreviation') or 'UNK','position':position,'height':roster.get('height',''),'weight':roster.get('weight',0),'jerseyNumber':roster.get('jerseyNumber',''),'headshotUrl':f'https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png','league':'NBA','source':'NBA Stats CommonAllPlayers + CommonTeamRoster','verification':'nba-stats-api-id','positionVerification':'official-team-roster' if position!='Unknown' else 'unverified','verified':True,'updatedAt':now})
    processed=ROOT/'data'/'processed';reports=ROOT/'data'/'reports';mappings=ROOT/'data'/'mappings';processed.mkdir(parents=True,exist_ok=True);reports.mkdir(parents=True,exist_ok=True);mappings.mkdir(parents=True,exist_ok=True)
    (processed/'players-candidate.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2),encoding='utf8')
    (mappings/'player-id-map.json').write_text(json.dumps({p['id']:p['id'] for p in candidates},indent=2),encoding='utf8')
    source_backed=sum(p['verification']=='nba-stats-api-id' for p in candidates)
    position_mapped=sum(p['positionVerification']=='official-team-roster' for p in candidates)
    report={'source':'reference entity IDs verified against NBA Stats CommonAllPlayers; positions joined by NBA Stats CommonTeamRoster','officialDirectoryAvailable':official_available,'candidateCount':len(candidates)+len(conflicts),'verifiedCount':source_backed,'sourceBackedCount':source_backed,'unverifiedCount':len(candidates)+len(conflicts)-source_backed,'positionMappedCount':position_mapped,'positionUnknownCount':len(candidates)-position_mapped,'positionMappingRate':round(position_mapped/len(candidates)*100,2) if candidates else 0,'conflictCount':len(conflicts),'generatedAt':now}
    (reports/'player-directory-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    (reports/'unmapped_players.json').write_text(json.dumps(conflicts,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(report))
    return report
if __name__=='__main__':main()
