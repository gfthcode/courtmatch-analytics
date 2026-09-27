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
WORK_DATA=Path(os.environ.get('COURTMATCH_DATA_WORK_DIR',ROOT/'data'))
sys.path.insert(0, str(ROOT/'scripts'))
from nba_api_retry import RetryExhaustedError, retry_nba_request

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

def validate_cached_directory(players:list[dict], report:dict)->dict[str,dict]:
    """Accept only a last-known-good directory previously verified by NBA Stats."""
    if not players:
        raise ValueError('cached player directory is empty')
    if not report.get('officialDirectoryAvailable'):
        raise ValueError('cached player directory has no successful NBA Stats verification report')
    generated_at=report.get('generatedAt')
    try:
        verified_at=datetime.fromisoformat(str(generated_at).replace('Z','+00:00'))
        if verified_at.tzinfo is None: verified_at=verified_at.replace(tzinfo=timezone.utc)
    except (TypeError,ValueError) as error:
        raise ValueError('cached player directory report has no valid verification timestamp') from error
    age=datetime.now(timezone.utc)-verified_at.astimezone(timezone.utc)
    if age.total_seconds() < -86400 or age.days > 365:
        raise ValueError('cached player directory verification is outside the allowed 365-day window')
    count=len(players)
    if (report.get('candidateCount')!=count or report.get('sourceBackedCount')!=count
            or report.get('conflictCount')!=0 or report.get('unverifiedCount')!=0):
        raise ValueError('cached player directory report is incomplete or contains unresolved identities')
    verified={}
    for player in players:
        player_id=str(player.get('id','')).strip()
        if (not player_id or player_id in verified or player.get('verified') is not True
                or player.get('verification')!='nba-stats-api-id'
                or not str(player.get('name','')).strip()):
            raise ValueError('cached player directory contains an unverified or duplicate NBA identity')
        verified[player_id]=player
    return verified

def load_verified_cached_directory(directory_path:str, report_path:str)->tuple[dict[str,dict],str]:
    players=json.loads(Path(directory_path).read_text(encoding='utf8'))
    report=json.loads(Path(report_path).read_text(encoding='utf8'))
    if not isinstance(players,list) or not isinstance(report,dict):
        raise ValueError('cached player directory or its verification report has an invalid shape')
    return validate_cached_directory(players,report),str(report.get('generatedAt',''))

def verify_identity(player_id:str, reference_name:str, directory:dict[str,dict])->tuple[dict|None,str|None]:
    """Resolve by immutable NBA ID first, then require a normalized name agreement."""
    official_row=directory.get(str(player_id))
    if official_row is None:
        return None,'official-id-not-found'
    if normalise(str(official_row.get('name','')))!=normalise(reference_name):
        return None,'official-name-mismatch'
    return official_row,None

def main():
    from nba_api.stats.endpoints import commonallplayers, commonteamroster
    if CSV_URL.startswith(('http://','https://')):
        with urlopen(CSV_URL,timeout=30,context=trusted_context()) as response: rows=list(csv.DictReader(line.decode('utf-8-sig') for line in response))
    else:
        with open(CSV_URL,encoding='utf-8-sig',newline='') as source: rows=list(csv.DictReader(source))

    cache_path=os.environ.get('COURTMATCH_CACHED_PLAYER_DIRECTORY','')
    cache_report_path=os.environ.get('COURTMATCH_CACHED_PLAYER_REPORT','')
    cached_directory={}
    cache_generated_at=''
    cache_error=None
    if cache_path and cache_report_path:
        try:
            cached_directory,cache_generated_at=load_verified_cached_directory(cache_path,cache_report_path)
        except (OSError,ValueError,json.JSONDecodeError) as error:
            cache_error=error
            print(f'Last-known-good NBA player directory cache is unusable: {error}',file=sys.stderr,flush=True)

    official_available=True
    cached_directory_used=False
    try:
        all_rows=retry_nba_request(lambda:commonallplayers.CommonAllPlayers(is_only_current_season=1,season=SEASON,timeout=45).get_dict()['resultSets'][0],label='CommonAllPlayers')
        official={str(row[0]):{'name':row[2],'teamId':str(row[8])} for row in all_rows['rowSet']}
        if not official:
            raise ValueError('NBA Stats CommonAllPlayers returned an empty directory')
    except RetryExhaustedError as error:
        if not cached_directory:
            raise RuntimeError('NBA Stats player directory is unavailable and no verified cache was usable') from (cache_error or error)
        official=cached_directory
        official_available=False
        cached_directory_used=True
        print(f'NBA Stats CommonAllPlayers unavailable; using verified directory cache from {cache_generated_at or "an undated report"}.',file=sys.stderr,flush=True)

    candidates=[]; conflicts=[]; seen=set(); now=datetime.now(timezone.utc).isoformat()
    # NBA Stats roster endpoints are the source of position/height/weight/number;
    # they are deliberately kept separate from the official-ID identity check.
    positions={}
    roster_api_unavailable=False
    teams={str(row['teamid']) for row in rows if row.get('teamid')}
    for index,team_id in enumerate(sorted(teams)):
        if roster_api_unavailable: break
        try:
            roster=retry_nba_request(lambda:commonteamroster.CommonTeamRoster(team_id=team_id,season=SEASON,timeout=30).get_dict()['resultSets'][0],label=f'CommonTeamRoster({team_id})')
            for roster_row in roster['rowSet']:
                positions[str(roster_row[14])]={'position':str(roster_row[7]).strip(),'height':str(roster_row[8] or ''),'weight':float(roster_row[9] or 0),'jerseyNumber':str(roster_row[6] or '')}
        except Exception as error:
            roster_api_unavailable=True
            print(f'NBA Stats roster unavailable for {team_id}: {error}',file=sys.stderr)
        if index+1<len(teams): time.sleep(0.75)
    for row in rows:
        player_id=str(row.get('entityid','')).strip();name=(row.get('name') or '').strip()
        if not player_id or not name: conflicts.append({'reason':'missing-id-or-name','row':row});continue
        if player_id in seen: conflicts.append({'reason':'duplicate-player-id','id':player_id,'name':name});continue
        seen.add(player_id); official_row,identity_error=verify_identity(player_id,name,official)
        if identity_error:
            conflicts.append({'reason':identity_error,'id':player_id,'referenceName':name,'officialName':official.get(player_id,{}).get('name')});continue
        # The immutable source entity ID is checked against NBA Stats by ID. Display
        # names are canonicalized from NBA Stats, not used to invent identity.
        roster=positions.get(player_id,{})
        cached_player=cached_directory.get(player_id,{})
        raw_position=roster.get('position','Unknown')
        position_source='official-team-roster'
        if raw_position=='Unknown' and cached_player.get('positionVerification')=='official-team-roster':
            raw_position=cached_player.get('position','Unknown')
            if raw_position!='Unknown': position_source='official-team-roster-cache'
        position={'F-G':'G-F','C-F':'F-C'}.get(raw_position,raw_position)
        if position not in {'G','F','C','G-F','F-C'}: position='Unknown'
        candidates.append({'id':player_id,'name':official_row['name'],'normalizedName':normalise(official_row['name']),'chineseName':official_row['name'],'aliases':[name,row.get('shortname','')], 'shortName':row.get('shortname') or official_row['name'],'teamId':str(row.get('teamid','')),'teamName':row.get('teamabbreviation') or 'Unknown','teamAbbreviation':row.get('teamabbreviation') or 'UNK','position':position,'height':roster.get('height',cached_player.get('height','')),'weight':roster.get('weight',cached_player.get('weight',0)),'jerseyNumber':roster.get('jerseyNumber',cached_player.get('jerseyNumber','')),'headshotUrl':f'https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png','league':'NBA','source':'NBA Stats verified directory cache + CommonTeamRoster' if cached_directory_used else 'NBA Stats CommonAllPlayers + CommonTeamRoster','verification':'nba-stats-api-id','verificationMode':'verified-cache' if cached_directory_used else 'live','positionVerification':position_source if position!='Unknown' else 'unverified','verified':True,'updatedAt':now if roster else cached_player.get('updatedAt',now)})
    processed=WORK_DATA/'processed';reports=WORK_DATA/'reports';mappings=WORK_DATA/'mappings';processed.mkdir(parents=True,exist_ok=True);reports.mkdir(parents=True,exist_ok=True);mappings.mkdir(parents=True,exist_ok=True)
    (processed/'players-candidate.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2),encoding='utf8')
    (mappings/'player-id-map.json').write_text(json.dumps({p['id']:p['id'] for p in candidates},indent=2),encoding='utf8')
    source_backed=sum(p['verification']=='nba-stats-api-id' for p in candidates)
    position_mapped=sum(p['positionVerification'] in {'official-team-roster','official-team-roster-cache'} for p in candidates)
    position_cached=sum(p['positionVerification']=='official-team-roster-cache' for p in candidates)
    report={'source':'reference entity IDs verified against NBA Stats CommonAllPlayers; positions joined to NBA Stats CommonTeamRoster','officialDirectoryAvailable':official_available,'cachedDirectoryUsed':cached_directory_used,'cachedDirectoryGeneratedAt':cache_generated_at or None,'candidateCount':len(candidates)+len(conflicts),'verifiedCount':source_backed,'sourceBackedCount':source_backed,'unverifiedCount':len(candidates)+len(conflicts)-source_backed,'positionMappedCount':position_mapped,'positionCachedCount':position_cached,'positionUnknownCount':len(candidates)-position_mapped,'positionMappingRate':round(position_mapped/len(candidates)*100,2) if candidates else 0,'conflictCount':len(conflicts),'generatedAt':now}
    (reports/'player-directory-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    (reports/'unmapped_players.json').write_text(json.dumps(conflicts,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(report))
    return report
if __name__=='__main__':main()
