import { describe, expect, it } from 'vitest';
import { calculateMatchupMetrics } from './api';
import type { MatchupRecord } from './types';

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
