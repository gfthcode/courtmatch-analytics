import { describe, expect, it } from 'vitest';
import { calculateMatchupMetrics, getRankings } from './api';
import type { Dataset, MatchupRecord, Player } from './types';

describe('matchup efficiency metrics', () => {
  it('keeps reference Matchup PPP distinct from points per 100 tracked possessions', () => {
    const record: MatchupRecord = {
      id: 'sample', offensivePlayerId: 'a', defensivePlayerId: 'b', season: '2025-26', seasonType: 'regular', league: 'NBA',
      matchupPossessions: 15, points: 20, fieldGoalAttempts: 10, fieldGoalsMade: 5, threePointAttempts: 3,
      threePointMade: 1, freeThrowAttempts: 4, freeThrowsMade: 3, turnovers: 2, updatedAt: '2026-09-26T00:00:00Z',
    };
    const metrics = calculateMatchupMetrics(record);
    expect(metrics.efficiency).toBeCloseTo(20 / (10 + 0.44 * 4 + 2));
    expect(metrics.pointsPer100).toBeCloseTo(20 / 15 * 100);
    expect(metrics.efficiency).not.toBe(metrics.pointsPer100);
  });
});

describe('ranking aggregation', () => {
  it('calculates current, previous-season and weighted stability values from one-pass totals', () => {
    const player = (id: string, position: Player['position']): Player => ({
      id, name: id.toUpperCase(), chineseName: id, aliases: [], shortName: id,
      teamId: 'team', teamName: 'Team', teamAbbreviation: 'TST', position,
      height: '6-6', weight: 200, jerseyNumber: '1', headshotUrl: '', league: 'NBA',
    });
    const record = (id: string, offense: string, defense: string, season: string, possessions: number, points: number): MatchupRecord => ({
      id, offensivePlayerId: offense, defensivePlayerId: defense, season, seasonType: 'regular', league: 'NBA',
      matchupPossessions: possessions, points, fieldGoalAttempts: 1, fieldGoalsMade: 1,
      threePointAttempts: 0, threePointMade: 0, freeThrowAttempts: 0, freeThrowsMade: 0,
      turnovers: 0, updatedAt: '2026-10-02',
    });
    const data = {
      players: [player('a', 'G'), player('b', 'F')], teams: [],
      matchups: [record('a1', 'a', 'b', '2025-26', 10, 20), record('a2', 'a', 'b', '2025-26', 30, 30), record('b1', 'b', 'a', '2025-26', 20, 10), record('old', 'a', 'b', '2024-25', 20, 10)],
      playerStats: [], playtypes: [], teamPlaytypes: [], teamStats: [],
      manifest: {} as Dataset['manifest'], source: 'test', updatedAt: '2026-10-02', mode: 'demo' as const, seasons: ['2024-25', '2025-26'],
    } satisfies Dataset;

    const rankings = getRankings(data, { season: '2025-26', type: 'regular', minPossessions: 0 });
    const a = rankings.find((ranking) => ranking.player.id === 'a')!;
    expect(a.offensePossessions).toBe(40);
    expect(a.defensePossessions).toBe(20);
    expect(a.possessions).toBe(40);
    expect(a.offense).toBe(125);
    expect(a.defense).toBe(50);
    expect(a.improvement).toBe(75);
    expect(a.stability).toBeCloseTo(Math.sqrt(1875));
    expect(a.rank).toBe(1);
  });

  it('uses the ranked direction for sample thresholds, display, and quality', () => {
    const player = (id: string): Player => ({ id, name: id, chineseName: id, shortName: id, aliases: [], teamId: 'team', teamName: 'Team', teamAbbreviation: 'TST', position: 'G', height: '6-6', weight: 200, jerseyNumber: '1', headshotUrl: '', league: 'NBA' });
    const record = (id: string, offense: string, defense: string, possessions: number): MatchupRecord => ({ id, offensivePlayerId: offense, defensivePlayerId: defense, season: '2025-26', seasonType: 'regular', league: 'NBA', matchupPossessions: possessions, points: possessions, fieldGoalAttempts: 1, fieldGoalsMade: 1, threePointAttempts: 0, threePointMade: 0, freeThrowAttempts: 0, freeThrowsMade: 0, turnovers: 0, updatedAt: '2026-10-02' });
    const data: Dataset = { players: [player('a'), player('b')], teams: [], matchups: [record('large-offense', 'a', 'b', 1000), record('tiny-defense', 'b', 'a', 1)], playerStats: [], playtypes: [], teamPlaytypes: [], teamStats: [], manifest: {} as Dataset['manifest'], source: 'test', updatedAt: '2026-10-02', mode: 'demo', seasons: ['2025-26'] };
    const filters = { season: '2025-26', type: 'regular' as const, minPossessions: 25 };
    const defensive = getRankings(data, { ...filters, metric: 'defense' });
    expect(defensive.map((row) => row.player.id)).toEqual(['b']);
    expect(defensive[0].possessions).toBe(1000);
    expect(defensive[0].quality).toBe('high');
    expect(defensive[0].rank).toBe(1);
    expect(getRankings(data, { ...filters, metric: 'offense' }).map((row) => row.player.id)).toEqual(['a']);
    expect(getRankings(data, { ...filters, metric: 'edge' }).map((row) => row.player.id)).toEqual(['b']);

    const lowSample = getRankings(data, { ...filters, metric: 'defense', minPossessions: 0, quality: 'low' });
    expect(lowSample.map((row) => row.player.id)).toEqual(['a']);
    expect(lowSample[0].possessions).toBe(1);
    expect(getRankings(data, { ...filters, perspective: 'defense' }).map((row) => row.player.id)).toEqual(['b']);

    const combined = getRankings(data, { ...filters, metric: 'possessions' });
    expect(combined).toHaveLength(2);
    expect(combined.every((row) => row.possessions === 1001 && row.quality === 'high')).toBe(true);
  });
});
