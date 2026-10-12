import { describe, expect, it } from 'vitest';
import { buildLineupFitReport, buildWatchlistReport } from './scout-agent';
import type { Dataset, Player, PlayerStats } from './types';

const player = (id: string, position: Player['position']): Player => ({
  id, name: id, chineseName: '', aliases: [], shortName: id, teamId: 'team', teamName: 'Team',
  teamAbbreviation: 'TST', position, height: '6-6', weight: 200, jerseyNumber: '1', headshotUrl: '', league: 'NBA',
});
const stats = (playerId: string, season: string, overrides: Partial<PlayerStats> = {}): PlayerStats => ({
  playerId, season, seasonType: 'regular', gamesPlayed: 20, pointsPerGame: 15, reboundsPerGame: 5,
  assistsPerGame: 4, stealsPerGame: 1, blocksPerGame: 1, fieldGoalPercentage: 0.5,
  threePointPercentage: 0.35, freeThrowPercentage: 0.8, updatedAt: '2026-10-01', ...overrides,
});
const dataset = (): Dataset => ({
  players: [player('guard', 'G'), player('wing', 'F'), player('big', 'C')], teams: [], matchups: [],
  playerStats: [
    stats('guard', '2025-26', { pointsPerGame: 20, threePointPercentage: 0.4 }),
    stats('wing', '2025-26', { pointsPerGame: 18 }), stats('big', '2025-26', { pointsPerGame: 12 }),
    stats('guard', '2024-25', { pointsPerGame: 17 }),
  ], playtypes: [], teamPlaytypes: [], teamStats: [],
  manifest: { status: 'live' } as Dataset['manifest'], source: 'test', updatedAt: '2026-10-01', mode: 'live', seasons: ['2024-25', '2025-26'],
});

describe('CourtMatch Agent local workflows', () => {
  it('reports a locally tracked player with season-over-season change and an explicit snapshot caveat', () => {
    const report = buildWatchlistReport(dataset(), ['guard'], false);
    expect(report.title).toContain('变化简报');
    expect(report.body).toContain('+3.0 分');
    expect(report.body).toContain('不是后台监控');
    expect(report.action?.href).toBe('/players');
  });

  it('returns matching lineup roles and selected skill criteria without claiming win probability', () => {
    const report = buildLineupFitReport(dataset(), '后卫与内线，投射和防守', false);
    expect(report.body).toContain('后卫');
    expect(report.body).toContain('内线');
    expect(report.body).toContain('guard (TST / G)');
    expect(report.body).toContain('big (TST / C)');
    expect(report.body).not.toContain('锋线\n');
    expect(report.body).toContain('不代表球员间化学反应');
  });

  it('explains lineup weights and rejects a zero-weight ranking', () => {
    const weights = { shooting: 2, playmaking: 1, scoring: 1, rebounding: 1, defense: 0 };
    const report = buildLineupFitReport(dataset(), '投射和防守后卫', false, weights);
    expect(report.body).toContain('三分命中率 ×2.0');
    expect(report.body).not.toContain('抢断+盖帽 ×0.0');
    expect(report.body).toContain('缺失指标按 0 计');
    const empty = buildLineupFitReport(dataset(), '投射和防守后卫', false, { ...weights, shooting: 0 });
    expect(empty.body).toContain('权重都为 0');
  });
});
