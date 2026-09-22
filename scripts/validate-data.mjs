/**
 * Fail-closed validation for browser-facing CourtMatch data.
 *
 * A demo manifest is intentionally allowed without JSON payloads: the client
 * will select its deterministic, bundled demo dataset. Every non-demo manifest
 * must instead reference a complete, internally consistent NBA-only dataset.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const requestedDirectory = process.argv[2] ?? 'data';
const dataDirectory = resolve(process.cwd(), requestedDirectory);
const requiredManifestFields = ['provider', 'status', 'league', 'lastUpdated', 'version', 'coverage', 'players', 'teams', 'matchups', 'playerCount', 'matchupRecordCount', 'isDemo'];
const allowedStatuses = new Set(['live', 'recently-updated', 'demo']);
const allowedPlayTypes = new Set(['Isolation', 'Transition', 'PRBallHandler', 'PRRollman', 'Postup', 'Spotup', 'Handoff', 'Cut', 'OffScreen', 'OffRebound', 'Misc']);

function fail(message) { throw new Error(`CourtMatch data validation failed: ${message}`); }
function assert(condition, message) { if (!condition) fail(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function isNonNegative(value) { return isFiniteNumber(value) && value >= 0; }
function assertTimestamp(value, label) { assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label} must be an ISO-compatible timestamp`); }
function assertString(value, label) { assert(typeof value === 'string' && value.trim(), `${label} must be a non-empty string`); }

async function readJson(name) {
  const path = resolve(dataDirectory, name);
  assert(path.startsWith(`${dataDirectory}${sep}`), `data path escapes catalogue directory: ${name}`);
  assert(existsSync(path), `required data file is missing: ${name}`);
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { fail(`unable to parse ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}

function assertDataFile(value, label) {
  assertString(value, label);
  assert(!value.includes('..') && !value.includes('/') && !value.includes('\\'), `${label} must be a JSON filename within the catalogue directory`);
  assert(value.endsWith('.json'), `${label} must end in .json`);
}

function assertUnique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    assert(isObject(row) && typeof row[key] === 'string' && row[key], `${label} has a missing ${key}`);
    assert(!seen.has(row[key]), `${label} has duplicate ${key}: ${row[key]}`);
    seen.add(row[key]);
  }
  return seen;
}

function validatePlayers(players, teamIds) {
  assert(Array.isArray(players) && players.length > 0, 'players must be a non-empty array');
  const playerIds = assertUnique(players, 'id', 'players');
  for (const player of players) {
    assert(player.league === 'NBA', `player ${player.id} is not NBA`);
    assertString(player.name, `player ${player.id}.name`);
    assertString(player.teamId, `player ${player.id}.teamId`);
    assert(teamIds.has(player.teamId), `player ${player.id} references missing team ${player.teamId}`);
  }
  return playerIds;
}

function validateTeams(teams) {
  assert(Array.isArray(teams) && teams.length > 0, 'teams must be a non-empty array');
  return assertUnique(teams, 'id', 'teams');
}

function validateMatchups(matchups, playerIds) {
  assert(Array.isArray(matchups) && matchups.length > 0, 'matchups must be a non-empty array');
  assertUnique(matchups, 'id', 'matchups');
  for (const row of matchups) {
    assert(row.league === 'NBA', `matchup ${row.id} is not NBA`);
    assert(playerIds.has(row.offensivePlayerId), `matchup ${row.id} references missing offensive player ${row.offensivePlayerId}`);
    assert(playerIds.has(row.defensivePlayerId), `matchup ${row.id} references missing defensive player ${row.defensivePlayerId}`);
    assert(row.offensivePlayerId !== row.defensivePlayerId, `matchup ${row.id} cannot use the same player on both sides`);
    assert(['regular', 'playoffs'].includes(row.seasonType), `matchup ${row.id} has unsupported season type`);
    assertString(row.season, `matchup ${row.id}.season`);
    assertTimestamp(row.updatedAt, `matchup ${row.id}.updatedAt`);
    for (const field of ['matchupPossessions', 'points', 'fieldGoalAttempts', 'fieldGoalsMade', 'threePointAttempts', 'threePointMade', 'freeThrowAttempts', 'freeThrowsMade', 'turnovers']) assert(isNonNegative(row[field]), `matchup ${row.id}.${field} must be finite and non-negative`);
    assert(row.matchupPossessions > 0, `matchup ${row.id}.matchupPossessions must be positive`);
    assert(row.fieldGoalsMade <= row.fieldGoalAttempts, `matchup ${row.id} has FGM greater than FGA`);
    assert(row.threePointAttempts <= row.fieldGoalAttempts, `matchup ${row.id} has 3PA greater than FGA`);
    assert(row.threePointMade <= row.threePointAttempts, `matchup ${row.id} has 3PM greater than 3PA`);
    assert(row.freeThrowsMade <= row.freeThrowAttempts, `matchup ${row.id} has FTM greater than FTA`);
  }
}

function validatePlaytypes(playtypes, playerIds) {
  assert(Array.isArray(playtypes), 'playtypes must be an array');
  for (const [index, row] of playtypes.entries()) {
    assert(isObject(row), `playtypes[${index}] must be an object`);
    assert(playerIds.has(row.playerId), `playtypes[${index}] references missing player ${row.playerId}`);
    assert(allowedPlayTypes.has(row.playType), `playtypes[${index}] has unsupported play type`);
    assert(['offensive', 'defensive'].includes(row.grouping), `playtypes[${index}] has unsupported grouping`);
    assert(isNonNegative(row.possessions), `playtypes[${index}].possessions must be finite and non-negative`);
    assert(row.pointsPerPossession === null || isNonNegative(row.pointsPerPossession), `playtypes[${index}].pointsPerPossession must be non-negative or null`);
    assertTimestamp(row.updatedAt, `playtypes[${index}].updatedAt`);
  }
}

const manifest = await readJson('manifest.json');
assert(isObject(manifest), 'manifest must be an object');
for (const field of requiredManifestFields) assert(field in manifest, `manifest is missing ${field}`);
assert(manifest.league === 'NBA', 'CourtMatch accepts NBA data only');
assert(allowedStatuses.has(manifest.status), `manifest has unsupported status: ${manifest.status}`);
assertTimestamp(manifest.lastUpdated, 'manifest.lastUpdated');
assertString(manifest.version, 'manifest.version');
assertString(manifest.coverage, 'manifest.coverage');
assert(Number.isInteger(manifest.playerCount) && manifest.playerCount >= 0, 'manifest.playerCount must be a non-negative integer');
assert(Number.isInteger(manifest.matchupRecordCount) && manifest.matchupRecordCount >= 0, 'manifest.matchupRecordCount must be a non-negative integer');
assert(typeof manifest.isDemo === 'boolean', 'manifest.isDemo must be boolean');

if (manifest.isDemo || manifest.status === 'demo') {
  assert(manifest.isDemo && manifest.status === 'demo', 'demo manifests must set both status=demo and isDemo=true');
  console.log(`Validated safe demo manifest ${manifest.version}; no unverified data is exposed as Live.`);
} else {
  assert(manifest.status === 'live' || manifest.status === 'recently-updated', 'non-demo data must have live or recently-updated status');
  for (const field of ['players', 'teams', 'matchups']) assertDataFile(manifest[field], `manifest.${field}`);
  if (manifest.playtypes !== undefined) assertDataFile(manifest.playtypes, 'manifest.playtypes');
  const teams = await readJson(manifest.teams);
  const teamIds = validateTeams(teams);
  const players = await readJson(manifest.players);
  const playerIds = validatePlayers(players, teamIds);
  const matchups = await readJson(manifest.matchups);
  validateMatchups(matchups, playerIds);
  if (manifest.playtypes) validatePlaytypes(await readJson(manifest.playtypes), playerIds);
  assert(players.length === manifest.playerCount, `manifest.playerCount (${manifest.playerCount}) does not equal players.json (${players.length})`);
  assert(matchups.length === manifest.matchupRecordCount, `manifest.matchupRecordCount (${manifest.matchupRecordCount}) does not equal matchups.json (${matchups.length})`);
  if (manifest.playtypes && manifest.playtypeRecordCount !== undefined) assert((await readJson(manifest.playtypes)).length === manifest.playtypeRecordCount, `manifest.playtypeRecordCount does not equal ${manifest.playtypes}`);
  console.log(`Validated ${manifest.provider} ${manifest.status} NBA dataset ${manifest.version}: ${players.length} players, ${matchups.length} matchups.`);
}
