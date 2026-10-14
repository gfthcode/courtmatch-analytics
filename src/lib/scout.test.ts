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
    const result = answerScoutQuestion(data, '比较 Stephen Curry 和 LeBron James 的直接对位 至少 25 回合', false);
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
    expect(answer.body).toContain('与赛季场均持平');
    const lower = { ...current, daily: [log('2026-06-12', 16), log('2026-06-13', 20)] };
    expect(answerScoutQuestion(lower, 'Curry 最近5场', false).body).toContain('低于赛季场均 7.0 分');
    expect(answerScoutQuestion(lower, 'Curry last 5 games', true).body).toContain('7.0 PPG below the season average');
  });

  const stats = (playerId: string, points: number, assists: number, overrides: Partial<PlayerStats> = {}): PlayerStats => ({ playerId, season: '2025-26', seasonType: 'regular', gamesPlayed: 70, pointsPerGame: points, reboundsPerGame: 4, assistsPerGame: assists, stealsPerGame: 1, blocksPerGame: 0.5, fieldGoalPercentage: 0.436, threePointPercentage: 0.422, freeThrowPercentage: 0.9, updatedAt: '2026-06-13', ...overrides });

  it('answers a general two-player comparison using season statistics, not their direct matchup', () => {
    const result = answerScoutQuestion({ ...data, playerStats: [stats('curry', 27, 5), stats('lebron', 25, 8)] }, '比较库里和詹姆斯的数据', false);
    expect(result.title).toContain('赛季数据比较');
    expect(result.body).toContain('27.0 分 / 4.0 篮板 / 5.0 助攻');
    expect(result.body).not.toContain('30.0 分 / 100');
    expect(result.action?.href).toContain('leftPlayer=curry&rightPlayer=lebron');
  });

  it('does not substitute regular-season stats into a missing playoff comparison', () => {
    const result = answerScoutQuestion({ ...data, playerStats: [stats('curry', 27, 5), stats('lebron', 25, 8)] }, '比较 Curry 和 LeBron 季后赛防守数据', false);
    expect(result.title).toContain('防守数据比较');
    expect(result.body).toContain('该赛季 / 阶段暂无球员统计');
    expect(result.body).not.toContain('1.0');
    expect(result.action?.href).toContain('type=playoffs');
  });

  it('recognizes statistical leaders, requested count, and excludes nonfinite or low-sample values', () => {
    const current = { ...data, playerStats: [stats('curry', 27, 5), stats('lebron', 25, 8), stats('tatum', 29, 12, { gamesPlayed: 1 })] };
    const result = answerScoutQuestion(current, '助攻最多的前一名', false);
    expect(result.title).toContain('场均助攻');
    expect(result.body).toContain('1. LeBron');
    expect(result.body).not.toContain('2.');
    expect(result.body).not.toContain('Tatum');
    const invalid = answerScoutQuestion({ ...current, playerStats: [stats('curry', Number.NaN, 5)] }, '得分榜前10', false);
    expect(invalid.body).toContain('没有合格的球员统计');
    expect(invalid.body).not.toContain('NaN');
  });

  it('requires attempts for shooting percentage leaders and respects a spaced top count', () => {
    const current = { ...data, playerStats: [stats('curry', 27, 5, { threePointersAttemptedPerGame: 10 }), stats('lebron', 25, 8, { threePointPercentage: 1, threePointersAttemptedPerGame: 0.1 })] };
    const result = answerScoutQuestion(current, '三分命中率前 1 名', false);
    expect(result.body).toContain('1. Curry');
    expect(result.body).not.toContain('LeBron');
    expect(result.body).toContain('42.2%');
  });

  it('routes the default lowest opponent scoring example to defense and reports empty coverage', () => {
    const result = answerScoutQuestion({ ...data, matchups: [] }, '样本对手得分最低前5', false);
    expect(result.title).toContain('样本对手得分');
    expect(result.action?.href).toContain('metric=defense');
    expect(result.body).toContain('没有合格记录');
  });

  it('qualifies a defensive leaderboard with defensive possessions rather than combined possessions', () => {
    const current = { ...data, matchups: [matchup('offense-heavy', 'curry', 'lebron', 1000, 300), matchup('tiny-defense', 'lebron', 'curry', 1, 0)] };
    const result = answerScoutQuestion(current, '防守榜前5 至少25回合', false);
    expect(result.body).toContain('1. LeBron');
    expect(result.body).not.toContain('Curry');
    expect(result.body).toContain('1000.0');
    expect(result.body).not.toContain('1001.0');
  });

  it('resolves common Chinese nicknames without matching abbreviations inside unrelated English words', () => {
    const durant: Player = { ...lebron, id: 'durant', name: 'Kevin Durant', chineseName: '', aliases: [], shortName: 'Kevin Durant' };
    const result = answerScoutQuestion({ ...data, players: [...data.players, durant], playerStats: [stats('durant', 26, 5)] }, '阿杜赛季表现', false);
    expect(result.title).toContain('Kevin Durant');
    const empty = answerScoutQuestion({ ...data, teams: [{ ...lakers, id: 'min', abbreviation: 'MIN', name: 'Minnesota Timberwolves' }] }, 'minimum 25 possessions leaders', true);
    expect(empty.title).toContain('Rankings');
    const initials = answerScoutQuestion({ ...data, players: [{ ...curry, shortName: 'S. Curry', aliases: ['S. Curry'] }], playerStats: [stats('curry', 27, 5)] }, 'S. Curry stats', true);
    expect(initials.title).toContain('S. Curry');
    const harden: Player = { ...lebron, id: 'harden', name: 'James Harden', chineseName: '詹姆斯·哈登', shortName: 'James Harden', aliases: ['哈登'] };
    const fullChinese = answerScoutQuestion({ ...data, players: [...data.players, harden], playerStats: [stats('harden', 22, 9)] }, '詹姆斯·哈登数据', false);
    expect(fullChinese.title).toContain('James Harden');
    expect(fullChinese.title).not.toContain('比较');
  });

  it('filters news by entity AND topic and keeps multiword English search terms separate', () => {
    const feed: ScoutNewsFeed = { ...news, articles: [...news.articles, { ...news.articles[0], id: 'curry-injury', title: 'Stephen Curry sidelined with ankle injury', titleZh: '库里因脚踝伤势缺阵', summary: 'An injury update for Curry.', summaryZh: '库里伤病情况更新。', url: 'https://www.espn.com/nba/story/curry-injury' }] };
    expect(answerScoutQuestion(data, '库里伤病新闻', false, feed).sources?.map((source) => source.href)).toEqual(['https://www.espn.com/nba/story/curry-injury']);
    expect(answerScoutQuestion(data, 'trade rumors news', true, feed).sources?.map((source) => source.href)).toEqual(['https://www.espn.com/nba/story/trade']);
    expect(answerScoutQuestion(data, '给我最新NBA新闻汇总', false, feed).sources).toHaveLength(4);
  });
});
