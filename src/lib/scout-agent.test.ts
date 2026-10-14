import { describe, expect, it } from 'vitest';
import { buildLineupFitReport, buildWatchlistReport } from './scout-agent';
import type { DailyGameLog, Dataset, Player, PlayerStats } from './types';

const player = (id: string, position: Player['position']): Player => ({
  id, name: id, chineseName: '', aliases: [], shortName: id, teamId: 'team', teamName: 'Team',
  teamAbbreviation: 'TST', position, height: '6-6', weight: 200, jerseyNumber: '1', headshotUrl: '', league: 'NBA',
});
const stats = (playerId: string, season: string, overrides: Partial<PlayerStats> = {}): PlayerStats => ({
  playerId, season, seasonType: 'regular', gamesPlayed: 20, minutesPerGame: 25, pointsPerGame: 15, reboundsPerGame: 5,
  assistsPerGame: 4, stealsPerGame: 1, blocksPerGame: 1, fieldGoalPercentage: 0.5,
  threePointPercentage: 0.35, threePointersAttemptedPerGame: 4, freeThrowPercentage: 0.8, updatedAt: '2026-10-01', ...overrides,
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
    expect(report.action?.href).toBe('/players?season=2025-26&type=regular');
  });

  it('returns matching lineup roles and selected skill criteria without claiming win probability', () => {
    const report = buildLineupFitReport(dataset(), '后卫与内线，投射和防守', false);
    expect(report.body).toContain('后卫');
    expect(report.body).toContain('内线');
    expect(report.body).toContain('guard (TST / 后卫)');
    expect(report.body).toContain('big (TST / 内线)');
    expect(report.body).not.toContain('锋线 ·');
    expect(report.body).toContain('不代表球员间化学反应');
  });

  it('explains lineup weights and rejects a zero-weight ranking', () => {
    const weights = { shooting: 2, playmaking: 1, scoring: 1, rebounding: 1, defense: 0 };
    const report = buildLineupFitReport(dataset(), '投射和防守后卫', false, weights);
    expect(report.body).toContain('三分命中率 ×2.0');
    expect(report.body).not.toContain('抢断+盖帽 ×0.0');
    expect(report.body).toContain('缺失的必选指标不参与候选排序');
    expect(report.body).toContain('权重为 0，未计入排序');
    const empty = buildLineupFitReport(dataset(), '投射和防守后卫', false, { ...weights, shooting: 0 });
    expect(empty.body).toContain('权重都为 0');
  });

  it('does not treat a one-attempt 100% shooter as a spacing candidate', () => {
    const current = dataset();
    current.playerStats = current.playerStats.map((row) => row.playerId === 'big' ? { ...row, threePointPercentage: 1, threePointersAttemptedPerGame: 0.1 } : row);
    const report = buildLineupFitReport(current, '寻找具备投射和防守能力的内线', false);
    expect(report.body).not.toContain('big (TST / 内线)');
    expect(report.body).toContain('赛季至少 50 次');
  });

  it('honors a requested older season and never substitutes a missing season or season type', () => {
    const older = buildLineupFitReport(dataset(), '2024-25 常规赛得分后卫', false);
    expect(older.body).toContain('2024-25 常规赛');
    expect(older.body).toContain('场均得分 17.0');
    expect(older.body).not.toContain('场均得分 20.0');
    const missing = buildLineupFitReport(dataset(), '2023-24 后卫', false);
    expect(missing.title).toContain('暂不可用');
    expect(missing.body).toContain('不会改用其他赛季');
    const playoffs = buildLineupFitReport(dataset(), '2026 playoffs centers', true);
    expect(playoffs.body).toContain('2025-26 playoffs');
    expect(playoffs.title).toContain('unavailable');
  });

  it('uses playoff rows with a playoff sample threshold and shares that period in the link', () => {
    const current = dataset();
    current.playerStats.push(stats('big', '2025-26', { seasonType: 'playoffs', gamesPlayed: 4, reboundsPerGame: 11 }));
    const report = buildLineupFitReport(current, '2026季后赛篮板内线', false);
    expect(report.body).toContain('至少 3 场');
    expect(report.body).toContain('场均篮板 11.0');
    expect(report.action?.href).toContain('type=playoffs');
  });

  it('filters out low minutes and unverifiable minutes, not just low games played', () => {
    const current = dataset();
    current.playerStats = current.playerStats.map((row) => ({ ...row, minutesPerGame: row.playerId === 'guard' ? 5 : undefined }));
    const report = buildLineupFitReport(current, '得分和防守', false);
    expect(report.title).toContain('样本不足');
    expect(report.body).toContain('场均至少 12 分钟');
    expect(buildLineupFitReport(dataset(), '得分后卫 至少30场', false).title).toContain('样本不足');
    expect(buildLineupFitReport(dataset(), '得分后卫 至少30分钟', false).title).toContain('样本不足');
  });

  it('keeps a non-shooting center eligible for a rebound request and explains the shooting limitation', () => {
    const current = dataset();
    current.playerStats = current.playerStats.map((row) => row.playerId === 'big' ? { ...row, threePointersAttemptedPerGame: 0.1 } : row);
    const report = buildLineupFitReport(current, '不要后卫，只要篮板内线', false);
    expect(report.body).toContain('big (TST / 内线)');
    expect(report.body).not.toContain('后卫 ·');
    expect(report.body).toContain('不能据此判断空间能力');
    const skipShooting = buildLineupFitReport(current, '不要三分，只要篮板内线', false);
    expect(skipShooting.body).toContain('big (TST / 内线)');
    expect(skipShooting.body).not.toContain('三分命中率 ×');
    const rebounding = buildLineupFitReport(current, '防守篮板内线', false);
    expect(rebounding.body).not.toContain('场均抢断+盖帽 ×');
  });

  it('excludes anchors, named players and specified teams without ignoring the role request', () => {
    const current = dataset();
    current.teams = [{ id: 'gsw', abbreviation: 'GSW', name: 'GSW', chineseName: 'GSW', logoUrl: '' }];
    current.players.push({ ...player('curry', 'G'), name: 'Stephen Curry', shortName: 'Stephen Curry', aliases: ['Curry'] });
    current.players.push({ ...player('green', 'C'), name: 'Draymond Green', shortName: 'Draymond Green', aliases: ['Green'], teamAbbreviation: 'GSW', teamId: 'gsw' });
    current.playerStats.push(stats('curry', '2025-26'), stats('green', '2025-26'));
    const report = buildLineupFitReport(current, '围绕 Curry 找篮板内线，排除勇士', false);
    expect(report.body).toContain('搭配对象：Stephen Curry');
    expect(report.body).toContain('big (TST / 内线)');
    expect(report.body).not.toContain('Draymond Green (');
    expect(report.body).not.toContain('Stephen Curry (');
    const excluded = buildLineupFitReport(current, '篮板内线排除 Green', false);
    expect(excluded.body).toContain('big (TST / 内线)');
    expect(excluded.body).not.toContain('Draymond Green (');
    const only = buildLineupFitReport(current, '只选勇士篮板内线', false);
    expect(only.body).toContain('Draymond Green (金州勇士 / 内线)');
    expect(only.body).not.toContain('big (');
  });

  it('uses bounded finite weights and percentile ranks with real strengths and trade-offs', () => {
    const current = dataset();
    current.players.push(player('rim', 'C'), player('stretch', 'C'));
    current.playerStats.push(
      stats('rim', '2025-26', { reboundsPerGame: 15, assistsPerGame: 0.2, blocksPerGame: 3 }),
      stats('stretch', '2025-26', { reboundsPerGame: 4, assistsPerGame: 6, blocksPerGame: 0.2 }),
    );
    const report = buildLineupFitReport(current, '篮板内线', false, { shooting: 0, scoring: 0, playmaking: 0, rebounding: 3, defense: Number.NaN });
    expect(report.body.indexOf('rim (')).toBeLessThan(report.body.indexOf('big ('));
    expect(report.body).toContain('相对强项：场均篮板 15.0');
    expect(report.body).toContain('需权衡：场均助攻 0.2');
    expect(report.body).not.toContain('NaN');
    expect(report.body).toContain('不同位置的分数不可直接比较');
  });

  it('deduplicates played games and reports points, rebounds, assists and covered dates', () => {
    const current = dataset();
    const game = (id: string, overrides: Partial<DailyGameLog>): DailyGameLog => ({
      id, playerId: 'guard', season: '2025-26', seasonType: 'regular', gameId: id,
      date: '2026-04-10', teamId: 'team', teamAbbreviation: 'TST', opponent: 'OTH', matchup: 'TST vs OTH', result: 'W',
      minutes: 30, points: 30, rebounds: 8, assists: 8, steals: 0, blocks: 0, turnovers: 0, personalFouls: 0,
      offensiveRebounds: 0, defensiveRebounds: 8, fieldGoalsMade: 10, fieldGoalsAttempted: 20, fieldGoalPercentage: 0.5,
      threePointersMade: 3, threePointersAttempted: 8, threePointPercentage: 0.375, freeThrowsMade: 7,
      freeThrowsAttempted: 8, freeThrowPercentage: 0.875, plusMinus: 5, updatedAt: '2026-04-11', ...overrides,
    });
    current.daily = [game('one', {}), game('duplicate', { gameId: 'one' }), game('two', { date: '2026-04-08', points: 20, rebounds: 6, assists: 4 }), game('dnp', { minutes: 0, date: '2026-04-12', points: 0 })];
    const report = buildWatchlistReport(current, ['guard', 'guard', 'missing'], false, { query: '近5场表现' });
    expect(report.body).toContain('最近 2 场');
    expect(report.body).toContain('25.0 分（较本季 +5.0）');
    expect(report.body).toContain('7.0 篮板（较本季 +2.0）');
    expect(report.body).toContain('6.0 助攻（较本季 +2.0）');
    expect(report.body).toContain('2026-04-08 至 2026-04-10');
    expect(report.body).toContain('仅有 2 场有效记录');
    expect(report.body).toContain('1 个已保存球员未在当前目录找到');
    expect(report.body).not.toContain('2026-04-12');
  });

  it('applies watchlist query periods, and distinguishes missing logs from missing season statistics', () => {
    const current = dataset();
    current.playerStats.push(stats('guard', '2025-26', { seasonType: 'playoffs', pointsPerGame: 31 }));
    const report = buildWatchlistReport(current, ['guard', 'wing'], false, { query: '2026季后赛最近10场' });
    expect(report.body).toContain('本季场均 31.0 分');
    expect(report.body).toContain('缺少 2025-26 季后赛 球员统计');
    expect(report.body).toContain('有效比赛日志');
    expect(report.action?.href).toContain('type=playoffs');
    expect(buildWatchlistReport(current, ['guard'], false, { query: '2022-23表现' }).title).toContain('暂不可用');
  });
});
