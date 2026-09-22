/** Fail-closed validation for browser-facing NBA-only CourtMatch data. */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const directory=resolve(process.cwd(),process.argv[2]??'public/data');
const required=['provider','status','league','lastUpdated','version','coverage','players','teams','matchups','playerCount','matchupRecordCount','isDemo'];
const playTypes=new Set(['Isolation','Transition','PRBallHandler','PRRollman','Postup','Spotup','Handoff','Cut','OffScreen','OffRebound','Misc']);
const fail=(message)=>{throw new Error(`CourtMatch data validation failed: ${message}`)};
const assert=(value,message)=>{if(!value)fail(message)};
const object=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=(value)=>typeof value==='number'&&Number.isFinite(value);
const timestamp=(value)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
async function json(name){assert(typeof name==='string'&&name.endsWith('.json')&&!name.includes('/')&&!name.includes('\\')&&!name.includes('..'),`unsafe JSON filename: ${name}`);const path=resolve(directory,name);assert(path.startsWith(`${directory}${sep}`),`file escapes data directory: ${name}`);assert(existsSync(path),`missing data file: ${name}`);try{return JSON.parse(await readFile(path,'utf8'))}catch(error){fail(`invalid JSON ${name}: ${error instanceof Error?error.message:String(error)}`)}}
function unique(rows,key,label){assert(Array.isArray(rows)&&rows.length>0,`${label} must be non-empty`);const ids=new Set();for(const row of rows){assert(object(row)&&typeof row[key]==='string'&&row[key],`${label} missing ${key}`);assert(!ids.has(row[key]),`${label} duplicate ${key}: ${row[key]}`);ids.add(row[key])}return ids}

const manifest=await json('manifest.json');
assert(object(manifest),'manifest must be an object');for(const field of required)assert(field in manifest,`manifest missing ${field}`);
assert(manifest.league==='NBA','only NBA data is accepted');assert(['live','recently-updated','stale','demo'].includes(manifest.status),'invalid manifest status');assert(timestamp(manifest.lastUpdated),'invalid manifest timestamp');assert(Number.isInteger(manifest.playerCount)&&manifest.playerCount>=0,'invalid player count');assert(Number.isInteger(manifest.matchupRecordCount)&&manifest.matchupRecordCount>=0,'invalid matchup count');
if(manifest.isDemo||manifest.status==='demo'){assert(manifest.isDemo&&manifest.status==='demo','demo status and isDemo must agree');console.log(`Validated safe demo manifest ${manifest.version}`);process.exit(0)}
assert(manifest.status==='live'||manifest.status==='recently-updated'||manifest.status==='stale','live data has invalid status');
const teams=await json(manifest.teams),teamIds=unique(teams,'id','teams');
const players=await json(manifest.players),playerIds=unique(players,'id','players');
for(const player of players){assert(player.league==='NBA',`player ${player.id} is not NBA`);assert(typeof player.name==='string'&&player.name,`player ${player.id} missing name`);assert(teamIds.has(player.teamId),`player ${player.id} has missing team`)}
const matchups=await json(manifest.matchups);unique(matchups,'id','matchups');
for(const row of matchups){assert(row.league==='NBA',`matchup ${row.id} is not NBA`);assert(playerIds.has(row.offensivePlayerId)&&playerIds.has(row.defensivePlayerId),`matchup ${row.id} has unknown player`);assert(row.offensivePlayerId!==row.defensivePlayerId,`matchup ${row.id} uses same player twice`);assert(['regular','playoffs'].includes(row.seasonType),`matchup ${row.id} has invalid season type`);assert(timestamp(row.updatedAt),`matchup ${row.id} has invalid timestamp`);for(const field of ['matchupPossessions','points','fieldGoalAttempts','fieldGoalsMade','threePointAttempts','threePointMade','freeThrowAttempts','freeThrowsMade','turnovers'])assert(finite(row[field])&&row[field]>=0,`matchup ${row.id}.${field} is invalid`);assert(row.matchupPossessions>0,`matchup ${row.id} has no possessions`);assert(row.fieldGoalsMade<=row.fieldGoalAttempts&&row.threePointAttempts<=row.fieldGoalAttempts&&row.threePointMade<=row.threePointAttempts&&row.freeThrowsMade<=row.freeThrowAttempts,`matchup ${row.id} has impossible shooting totals`)}
if(manifest.playtypes){const records=await json(manifest.playtypes);for(const row of records){assert(object(row)&&playerIds.has(row.playerId),`play type has unknown player`);assert(playTypes.has(row.playType),`play type ${row.playType} is unsupported`);assert(['offensive','defensive'].includes(row.grouping),`play type grouping is invalid`);assert(finite(row.possessions)&&row.possessions>=0,'play type possessions are invalid');assert(row.pointsPerPossession===null||(finite(row.pointsPerPossession)&&row.pointsPerPossession>=0),'play type PPP is invalid');assert(timestamp(row.updatedAt),'play type timestamp is invalid')}assert(manifest.playtypeRecordCount===undefined||records.length===manifest.playtypeRecordCount,'play type count mismatch')}
assert(players.length===manifest.playerCount,'player count mismatch');assert(matchups.length===manifest.matchupRecordCount,'matchup count mismatch');
console.log(`Validated ${manifest.provider} ${manifest.status} NBA dataset ${manifest.version}: ${players.length} players, ${matchups.length} matchups.`);
