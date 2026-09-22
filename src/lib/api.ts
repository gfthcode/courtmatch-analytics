import type { Dataset, Filters, MatchupMetrics, MatchupRecord, Player, PlayerStats, PlayTypeRecord, Ranking, SampleQuality, TeamStats } from './types';

export type DataFilters = Partial<Filters>;
const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\s·.'’-]/g, '');
export function getSampleQuality(possessions: number): SampleQuality { return possessions < 25 ? 'low' : possessions < 75 ? 'medium' : 'high'; }
export function num(value: number | null | undefined, decimals = 1): string { return value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value); }
export function percentage(value: number | null | undefined, decimals = 1): string { return value == null || !Number.isFinite(value) ? '—' : `${num(value, decimals)}%`; }
export const fmt = num;
export const formatNumber = num;
export const formatPercentage = percentage;
export const getPlayers = (data: Dataset): Player[] => data.players;
export const getTeams = (data: Dataset) => data.teams;
export const getPlayerById = (data: Dataset, id: string): Player | undefined => data.players.find((player) => player.id === id);
export const getPlayerStats=(data:Dataset,playerId:string,filters:DataFilters={}):PlayerStats[]=>data.playerStats.filter(row=>row.playerId===playerId&&(!filters.season||row.season===filters.season)&&(!filters.type||row.seasonType===filters.type));
export const getPlayerPlayTypes=(data:Dataset,playerId:string,filters:DataFilters={}):PlayTypeRecord[]=>data.playtypes.filter(row=>row.playerId===playerId&&(!filters.season||row.season===filters.season)&&(!filters.type||row.seasonType===filters.type));
export const getTeamStats=(data:Dataset,teamId:string,filters:DataFilters={}):TeamStats[]=>data.teamStats.filter(row=>row.teamId===teamId&&(!filters.season||row.season===filters.season)&&(!filters.type||row.seasonType===filters.type));

export function searchPlayers(data: Dataset, query: string, team?: string): Player[] {
  const value = normalize(query);
  return data.players.filter((player) => (!team || player.teamId === team) && (!value || [player.id, player.name, player.chineseName, player.shortName, player.teamName, player.teamAbbreviation, data.teams.find((item) => item.id === player.teamId)?.chineseName ?? '', ...player.aliases].some((entry) => normalize(entry).includes(value))));
}

/** Efficiency is a scoring-event ratio; pointsPer100 uses the recorded possession count. */
export function calculateMatchupMetrics(record: MatchupRecord, leagueAverage: number | null = null): MatchupMetrics {
  const denominator = record.fieldGoalAttempts + 0.44 * record.freeThrowAttempts + record.turnovers;
  const pointsPer100 = record.matchupPossessions > 0 ? record.points / record.matchupPossessions * 100 : null;
  return {
    efficiency: denominator > 0 ? record.points / denominator : null,
    pointsPer100,
    fieldGoalPercentage: record.fieldGoalAttempts > 0 ? record.fieldGoalsMade / record.fieldGoalAttempts * 100 : null,
    threePointPercentage: record.threePointAttempts > 0 ? record.threePointMade / record.threePointAttempts * 100 : null,
    turnoverRate: record.matchupPossessions > 0 ? record.turnovers / record.matchupPossessions * 100 : null,
    leagueAverage,
    differenceFromLeagueAverage: pointsPer100 !== null && leagueAverage !== null && leagueAverage > 0 ? (pointsPer100 / leagueAverage - 1) * 100 : null,
    sampleQuality: getSampleQuality(record.matchupPossessions),
  };
}

export function aggregateRecords(records: MatchupRecord[]): MatchupRecord | null {
  if (!records.length) return null;
  const sum = (field: 'matchupPossessions' | 'points' | 'fieldGoalAttempts' | 'fieldGoalsMade' | 'threePointAttempts' | 'threePointMade' | 'freeThrowAttempts' | 'freeThrowsMade' | 'turnovers') => records.reduce((total, record) => total + record[field], 0);
  return {
    ...records[0], id: `aggregate:${records.length}:${records[0].id}`,
    matchupPossessions: sum('matchupPossessions'), points: sum('points'), fieldGoalAttempts: sum('fieldGoalAttempts'), fieldGoalsMade: sum('fieldGoalsMade'), threePointAttempts: sum('threePointAttempts'), threePointMade: sum('threePointMade'), freeThrowAttempts: sum('freeThrowAttempts'), freeThrowsMade: sum('freeThrowsMade'), turnovers: sum('turnovers'),
    assists: records.every((record) => record.assists !== undefined) ? records.reduce((total, record) => total + record.assists!, 0) : undefined,
    rebounds: records.every((record) => record.rebounds !== undefined) ? records.reduce((total, record) => total + record.rebounds!, 0) : undefined,
    updatedAt: records.reduce((latest, record) => record.updatedAt > latest ? record.updatedAt : latest, records[0].updatedAt),
  };
}

function inPeriod(record: MatchupRecord, filters: DataFilters): boolean {
  return (!filters.season || record.season === filters.season) && (!filters.type || record.seasonType === filters.type);
}
function meetsSample(record: MatchupRecord, filters: DataFilters): boolean {
  return record.matchupPossessions >= (filters.minPossessions ?? 0) && (!filters.quality || getSampleQuality(record.matchupPossessions) === filters.quality);
}

export function getMatchups(data: Dataset, filters: DataFilters = {}): MatchupRecord[] {
  const players = new Map(data.players.map((player) => [player.id, player]));
  const searchedIds = new Set(searchPlayers(data, filters.search ?? '').map((player) => player.id));
  return data.matchups.filter((record) => {
    if (!inPeriod(record, filters) || !meetsSample(record, filters)) return false;
    const primaryId = filters.perspective === 'defense' ? record.defensivePlayerId : record.offensivePlayerId;
    const oppositeId = filters.perspective === 'defense' ? record.offensivePlayerId : record.defensivePlayerId;
    const primary = players.get(primaryId), opponent = players.get(oppositeId);
    return (!filters.player || primaryId === filters.player) && (!filters.team || primary?.teamId === filters.team) && (!filters.opponentTeam || opponent?.teamId === filters.opponentTeam) && (!filters.position || opponent?.position === filters.position) && (!filters.search || searchedIds.has(oppositeId));
  });
}

export const getPlayerMatchups = (data: Dataset, id: string, filters: DataFilters = {}) => getMatchups(data, { ...filters, player: id });
export function getHeadToHeadMatchup(data: Dataset, a: string, b: string, filters: DataFilters = {}): { a: MatchupRecord[]; b: MatchupRecord[] } {
  const period = data.matchups.filter((record) => inPeriod(record, filters) && meetsSample(record, filters));
  return {
    a: period.filter((record) => record.offensivePlayerId === a && record.defensivePlayerId === b),
    b: period.filter((record) => record.offensivePlayerId === b && record.defensivePlayerId === a),
  };
}

/** Weighted coverage average. Not an official league-wide average when coverage is partial. */
export function leagueAverage(data: Dataset, filters: DataFilters = {}): number | null {
  const totals = aggregateRecords(data.matchups.filter((record) => inPeriod(record, filters)));
  return totals ? calculateMatchupMetrics(totals).pointsPer100 : null;
}

const rate = (records: MatchupRecord[]): number | null => {
  const aggregate = aggregateRecords(records);
  return aggregate ? calculateMatchupMetrics(aggregate).pointsPer100 : null;
};

export function getRankings(data: Dataset, filters: DataFilters = {}): Ranking[] {
  const current = data.matchups.filter((record) => inPeriod(record, filters));
  const seasonIndex = [...data.seasons].sort().indexOf(filters.season ?? '');
  const previousSeason = [...data.seasons].sort()[seasonIndex - 1];
  const previous = previousSeason ? data.matchups.filter((record) => record.season === previousSeason && (!filters.type || record.seasonType === filters.type)) : [];
  const average = leagueAverage(data, filters);
  const candidates = searchPlayers(data, filters.search ?? '', filters.team).filter((player) => !filters.position || player.position === filters.position);
  const rankings: Ranking[] = candidates.map((player) => {
    const offensiveRecords = current.filter((record) => record.offensivePlayerId === player.id);
    const defensiveRecords = current.filter((record) => record.defensivePlayerId === player.id);
    const offensePossessions = offensiveRecords.reduce((total, record) => total + record.matchupPossessions, 0);
    const defensePossessions = defensiveRecords.reduce((total, record) => total + record.matchupPossessions, 0);
    const offense = rate(offensiveRecords), defense = rate(defensiveRecords);
    const previousRate = rate(previous.filter((record) => record.offensivePlayerId === player.id));
    const variance = offense === null || !offensePossessions ? null : offensiveRecords.reduce((total, record) => total + (record.matchupPossessions > 0 ? record.matchupPossessions * (record.points / record.matchupPossessions * 100 - offense) ** 2 : 0), 0) / offensePossessions;
    const possessions = offensePossessions + defensePossessions;
    return { player, possessions, offensePossessions, defensePossessions, offense, defense,
      edge: average !== null && defense !== null ? average - defense : null,
      improvement: offense !== null && previousRate !== null ? offense - previousRate : null,
      stability: variance === null ? null : Math.sqrt(variance),
      quality: getSampleQuality(possessions), rank: 0, positionRank: 0 };
  }).filter((ranking) => ranking.possessions > 0 && ranking.possessions >= (filters.minPossessions ?? 0) && (!filters.quality || ranking.quality === filters.quality));
  const metric = filters.metric ?? 'offense';
  const field: 'offense' | 'defense' | 'possessions' | 'edge' | 'improvement' | 'stability' = metric === 'decline' ? 'improvement' : ['defense', 'possessions', 'edge', 'improvement', 'stability'].includes(metric) ? metric as 'defense' | 'possessions' | 'edge' | 'improvement' | 'stability' : 'offense';
  const ascending = filters.order ? filters.order === 'asc' : ['defense', 'decline', 'stability'].includes(metric);
  rankings.sort((a, b) => {
    const left = a[field], right = b[field];
    if (left === null) return right === null ? a.player.name.localeCompare(b.player.name) : 1;
    if (right === null) return -1;
    return (ascending ? left - right : right - left) || a.player.name.localeCompare(b.player.name);
  });
  const positions = new Map<string, number>();
  return rankings.map((ranking, index) => {
    const positionRank = (positions.get(ranking.player.position) ?? 0) + 1;
    positions.set(ranking.player.position, positionRank);
    return { ...ranking, rank: index + 1, positionRank };
  });
}
