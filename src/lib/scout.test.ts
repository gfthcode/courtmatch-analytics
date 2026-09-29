import { describe, expect, it } from 'vitest';
import { DEMO_DATA } from './data';
import { answerScoutQuestion } from './scout';
import type { MatchupRecord, Player, TeamStats } from './types';

const curry: Player = { id: 'curry', name: 'Stephen Curry', chineseName: '斯蒂芬·库里', aliases: ['Curry'], shortName: 'Curry', teamId: 'gsw', teamName: 'Golden State Warriors', teamAbbreviation: 'GSW', position: 'G', height: '6-2', weight: 185, jerseyNumber: '30', headshotUrl: '', league: 'NBA' };
const lebron: Player = { id: 'lebron', name: 'LeBron James', chineseName: '勒布朗·詹姆斯', aliases: ['LeBron'], shortName: 'LeBron', teamId: 'lal', teamName: 'Los Angeles Lakers', teamAbbreviation: 'LAL', position: 'F', height: '6-9', weight: 250, jerseyNumber: '23', headshotUrl: '', league: 'NBA' };
const jayson: Player = { ...lebron, id: 'tatum', name: 'Jayson Tatum', chineseName: '杰森·塔图姆', aliases: ['Tatum'], shortName: 'Tatum', teamId: 'bos', teamAbbreviation: 'BOS' };
const celtics = { id: 'bos', name: 'Boston Celtics', chineseName: '波士顿凯尔特人', abbreviation: 'BOS', logoUrl: '' };
const lakers = { id: 'lal', name: 'Los Angeles Lakers', chineseName: '洛杉矶湖人', abbreviation: 'LAL', logoUrl: '' };

function matchup(id: string, offense: string, defense: string, possessions: number, points: number): MatchupRecord {
  return { id, offensivePlayerId: offense, defensivePlayerId: defense, season: '2025-26', seasonType: 'regular', league: 'NBA', matchupPossessions: possessions, points, fieldGoalAttempts: 10, fieldGoalsMade: 5, threePointAttempts: 4, threePointMade: 2, freeThrowAttempts: 2, freeThrowsMade: 2, turnovers: 1, updatedAt: '2026-09-27T00:00:00Z' };
}

const data = {
  ...DEMO_DATA,
  teams: [celtics, lakers],
  players: [curry, lebron, jayson],
  matchups: [matchup('1', 'curry', 'lebron', 80, 24), matchup('2', 'lebron', 'curry', 60, 18), matchup('3', 'curry', 'tatum', 40, 8)],
  teamStats: [
    { teamId: 'bos', season: '2025-26', seasonType: 'regular' as const, gamesPlayed: 82, offensiveRating: 120, defensiveRating: 110, pace: 99, updatedAt: '2026-09-27T00:00:00Z' },
    { teamId: 'lal', season: '2025-26', seasonType: 'regular' as const, gamesPlayed: 82, offensiveRating: 115, defensiveRating: 112, pace: 101, updatedAt: '2026-09-27T00:00:00Z' },
  ] satisfies TeamStats[],
  playerStats: [],
  seasons: ['2025-26'],
  updatedAt: '2026-09-27T00:00:00Z',
  manifest: { ...DEMO_DATA.manifest, status: 'live' as const },
};

describe('CourtMatch Scout answers', () => {
  it('compares both directions and links to a prefilled comparison page', () => {
    const result = answerScoutQuestion(data, '比较 Stephen Curry 和 LeBron James 至少 25 回合', false);
    expect(result.title).toContain('Curry');
    expect(result.body).toContain('30.0');
    expect(result.body.match(/30\.0/g)).toHaveLength(2);
    expect(result.action?.href).toContain('leftPlayer=curry');
    expect(result.action?.href).toContain('rightPlayer=lebron');
  });

  it('finds the lowest-scoring matchups when asked who limits a player', () => {
    const result = answerScoutQuestion(data, '谁最能限制 Stephen Curry？至少 25 回合', false);
    expect(result.title).toContain('受限对位');
    expect(result.body).toContain('Tatum');
    expect(result.body).toContain('20.0');
  });

  it('explains the supported scope rather than inventing unsupported answers', () => {
    const result = answerScoutQuestion(data, '今晚谁会赢？', false);
    expect(result.body).toContain('不支持伤病判断、实时新闻、比赛预测');
  });

  it('compares available team ratings and links to the team comparison page', () => {
    const result = answerScoutQuestion(data, '比较 Boston Celtics 和 Los Angeles Lakers 球队效率', false);
    expect(result.title).toContain('球队对比');
    expect(result.body).toContain('进攻效率 120.0');
    expect(result.body).toContain('净效率 10.0');
    expect(result.action?.href).toContain('/team/compare?left=bos&right=lal');
  });

  it('resolves NBA teams from common English nicknames and Chinese full names', () => {
    const nickname = answerScoutQuestion(data, '比较 Celtics 和 Lakers 球队效率', true);
    const chinese = answerScoutQuestion(data, '比较波士顿凯尔特人和洛杉矶湖人球队效率', false);
    expect(nickname.action?.href).toContain('left=bos&right=lal');
    expect(chinese.body).toContain('进攻效率 120.0');
    expect(chinese.action?.href).toContain('left=bos&right=lal');
  });

  it('does not infer team ratings when the published team snapshot is missing', () => {
    const result = answerScoutQuestion({ ...data, teamStats: [] }, '查询 Boston Celtics 球队数据', false);
    expect(result.body).toContain('没有该赛季球队统计记录');
    expect(result.body).not.toContain('进攻效率 120.0');
  });
});
