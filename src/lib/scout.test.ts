import { describe, expect, it } from 'vitest';
import { DEMO_DATA } from './data';
import { answerScoutQuestion, type ScoutNewsFeed } from './scout';
import type { DailyGameLog, MatchupRecord, Player, PlayerStats, TeamStats } from './types';

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

const news: ScoutNewsFeed = {
  source: 'ESPN NBA News API',
  updatedAt: '2026-09-29T01:00:47Z',
  articles: [
    { id: 'curry-news', title: 'Stephen Curry leads Warriors to a win', titleZh: '库里率勇士取胜', summary: 'Curry made seven threes.', summaryZh: '库里投进了七记三分球。', url: 'https://www.espn.com/nba/story/curry', publishedAt: '2026-09-29T00:00:00Z', author: 'ESPN', categories: ['Golden State Warriors'] },
    { id: 'trade-news', title: 'League trade talks continue', summary: 'Several teams are exploring a trade.', url: 'https://www.espn.com/nba/story/trade', publishedAt: '2026-09-28T00:00:00Z', categories: ['NBA'] },
    { id: 'celtics-news', title: 'Boston Celtics prepare for the new season', titleZh: '凯尔特人为新赛季做准备', summary: 'The Celtics discussed their lineup.', summaryZh: '凯尔特人谈到了球队阵容。', url: 'https://www.espn.com/nba/story/celtics', publishedAt: '2026-09-27T00:00:00Z', categories: ['Boston Celtics'] },
  ],
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
    expect(result.title).toContain('样本中低得分对位');
    expect(result.body).toContain('Tatum');
    expect(result.body).toContain('20.0');
    expect(result.body).toContain('换防、协防');
  });

  it('explains the supported scope rather than inventing unsupported answers', () => {
    const result = answerScoutQuestion(data, '今晚谁会赢？', false);
    expect(result.body).toContain('没有经过核验的实时伤病、赛前出场名单或比赛预测数据');
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

  it('searches the published news feed by player and returns original source links', () => {
    const result = answerScoutQuestion(data, '库里最近新闻', false, news);
    expect(result.title).toContain('Curry');
    expect(result.body).toContain('库里率勇士取胜');
    expect(result.body).toContain('库里投进了七记三分球。');
    expect(result.body).not.toContain('League trade talks');
    expect(result.sources).toEqual([{ label: '库里率勇士取胜', href: 'https://www.espn.com/nba/story/curry' }]);
    expect(result.action?.href).toBe('/news');
  });

  it('searches general news topics and reports when the feed is missing', () => {
    const topic = answerScoutQuestion(data, '交易新闻', true, news);
    const unavailable = answerScoutQuestion(data, 'NBA 最新新闻', false);
    expect(topic.sources).toHaveLength(1);
    expect(topic.sources?.[0].label).toContain('trade talks');
    expect(topic.body).toContain('Feed updated');
    expect(unavailable.title).toContain('暂不可用');
  });

  it('filters news by NBA team names and Chinese nicknames', () => {
    const result = answerScoutQuestion(data, '凯尔特人新闻', false, news);
    expect(result.title).toContain('波士顿凯尔特人');
    expect(result.sources).toEqual([{ label: '凯尔特人为新赛季做准备', href: 'https://www.espn.com/nba/story/celtics' }]);
  });

  it('keeps original headlines in English but never leaks untranslated copy into Chinese answers', () => {
    const english = answerScoutQuestion(data, 'Curry news', true, news);
    expect(english.body).toContain('Stephen Curry leads Warriors to a win');
    const untranslated: ScoutNewsFeed = { ...news, articles: [{ ...news.articles[0], titleZh: undefined, summaryZh: undefined }] };
    const chinese = answerScoutQuestion(data, '库里新闻', false, untranslated);
    expect(chinese.body).toContain('新闻标题翻译暂不可用');
    expect(chinese.body).toContain('新闻摘要翻译暂不可用');
    expect(chinese.sources?.[0].label).toBe('阅读新闻原文');
  });

  it('shows real percentages, source coverage, and refuses an unavailable season', () => {
    const row: PlayerStats = { playerId: 'curry', season: '2025-26', seasonType: 'regular', gamesPlayed: 70, pointsPerGame: 25, reboundsPerGame: 4, assistsPerGame: 6, stealsPerGame: 1, blocksPerGame: 0, fieldGoalPercentage: 0.436, threePointPercentage: 0.422, freeThrowPercentage: 0.9, updatedAt: '2026-06-13' };
    const current = { ...data, playerStats: [row], manifest: { ...data.manifest, nbaStatsDataThrough: '2026-06-13' } };
    const answer = answerScoutQuestion(current, 'Stephen Curry 赛季数据', false);
    expect(answer.body).toContain('43.6% / 42.2%');
    expect(answer.body).toContain('比赛记录截止 2026-06-13');
    const missing = answerScoutQuestion(current, 'Stephen Curry 2026-27 数据', false);
    expect(missing.title).toContain('赛季暂无数据');
    expect(missing.body).not.toContain('25.0');
  });

  it('uses published game logs for recent form and labels a short sample', () => {
    const row: PlayerStats = { playerId: 'curry', season: '2025-26', seasonType: 'regular', gamesPlayed: 70, pointsPerGame: 25, reboundsPerGame: 4, assistsPerGame: 6, stealsPerGame: 1, blocksPerGame: 0, fieldGoalPercentage: 0.436, threePointPercentage: 0.422, freeThrowPercentage: 0.9, updatedAt: '2026-06-13' };
    const log = (date: string, points: number): DailyGameLog => ({ id: date, playerId: 'curry', season: '2025-26', seasonType: 'regular', gameId: date, date, teamId: 'gsw', teamAbbreviation: 'GSW', opponent: 'LAL', matchup: 'GSW vs LAL', result: 'W', minutes: 30, points, rebounds: 5, offensiveRebounds: 0, defensiveRebounds: 5, assists: 7, steals: 1, blocks: 0, turnovers: 2, personalFouls: 1, fieldGoalsMade: 10, fieldGoalsAttempted: 20, fieldGoalPercentage: 0.5, threePointersMade: 4, threePointersAttempted: 10, threePointPercentage: 0.4, freeThrowsMade: 2, freeThrowsAttempted: 2, freeThrowPercentage: 1, plusMinus: 3, updatedAt: date });
    const current = { ...data, playerStats: [row], daily: [log('2026-06-12', 20), log('2026-06-13', 30)] };
    const answer = answerScoutQuestion(current, 'Stephen Curry 最近 3 场', false);
    expect(answer.body).toContain('最近 2 场已记录比赛');
    expect(answer.body).toContain('请求 3 场，当前仅找到 2 场');
    expect(answer.body).toContain('场均 25.0 分');
  });
});
