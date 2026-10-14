import { describe, expect, it } from 'vitest';
import { DEMO_DATA } from './data';
import { answerScoutQuestion } from './scout';
import { getScoutFollowUps, resolveScoutTurn } from './scout-conversation';

describe('Scout conversation context', () => {
  it('keeps player, recent-game count and the requested phase across short follow-ups', () => {
    const first = resolveScoutTurn(DEMO_DATA, '库里');
    expect(first.context.playerIds).toHaveLength(1);
    const recent = resolveScoutTurn(DEMO_DATA, '他最近5场', first.context);
    expect(recent.context.intent).toBe('recent');
    expect(recent.resolvedQuery).toContain('Stephen Curry');
    const playoffs = resolveScoutTurn(DEMO_DATA, '那季后赛呢', recent.context);
    expect(playoffs.usedContext).toBe(true);
    expect(playoffs.context.seasonType).toBe('playoffs');
    expect(playoffs.context.recentGames).toBe(5);
    expect(playoffs.resolvedQuery).toContain('最近 5 场');
    expect(playoffs.resolvedQuery).not.toContain('常规赛');
  });

  it('keeps both players for defense follow-ups and switches explicitly to direct matchup', () => {
    const comparison = resolveScoutTurn(DEMO_DATA, '比较库里和詹姆斯');
    const defense = resolveScoutTurn(DEMO_DATA, '改看防守', comparison.context);
    expect(defense.context.intent).toBe('comparison');
    expect(defense.context.playerIds).toHaveLength(2);
    expect(answerScoutQuestion(DEMO_DATA, defense.resolvedQuery, false).title).toContain('防守数据比较');
    const matchup = resolveScoutTurn(DEMO_DATA, '他们的直接对位呢', defense.context);
    expect(matchup.context.intent).toBe('matchup');
    expect(answerScoutQuestion(DEMO_DATA, matchup.resolvedQuery, false).title).toContain('对位');
  });

  it('clears player context for new league news or leaderboards but preserves an explicit pronoun', () => {
    const first = resolveScoutTurn(DEMO_DATA, '库里');
    expect(resolveScoutTurn(DEMO_DATA, '最新NBA新闻', first.context).context.playerIds).toEqual([]);
    expect(resolveScoutTurn(DEMO_DATA, '助攻榜前10', first.context).context.playerIds).toEqual([]);
    expect(resolveScoutTurn(DEMO_DATA, '其他新闻', first.context).context.playerIds).toEqual([]);
    const news = resolveScoutTurn(DEMO_DATA, '他的伤病新闻', first.context);
    expect(news.context.playerIds).toEqual(first.context.playerIds);
    expect(news.resolvedQuery).toContain('Stephen Curry');
    expect(news.resolvedQuery).toContain('伤病');
  });

  it('can add one named comparison target to the current player without replacing him', () => {
    const first = resolveScoutTurn(DEMO_DATA, '库里');
    const compare = resolveScoutTurn(DEMO_DATA, '那和詹姆斯比较呢', first.context);
    expect(compare.usedContext).toBe(true);
    expect(compare.context.playerIds).toHaveLength(2);
    expect(compare.context.intent).toBe('comparison');
  });

  it('carries ranking metric and result count to another phase without inheriting a player', () => {
    const leaders = resolveScoutTurn(DEMO_DATA, '助攻榜前10');
    const playoffs = resolveScoutTurn(DEMO_DATA, '那季后赛呢', leaders.context);
    expect(playoffs.context.intent).toBe('rankings');
    expect(playoffs.context.rankingTopic).toBe('助攻');
    expect(playoffs.resolvedQuery).toContain('前 10');
    expect(playoffs.context.seasonType).toBe('playoffs');
  });

  it('replaces old entities on a new player question and does not guess an entity for unrelated text', () => {
    const first = resolveScoutTurn(DEMO_DATA, '库里最近5场');
    const next = resolveScoutTurn(DEMO_DATA, '詹姆斯', first.context);
    expect(next.context.intent).toBe('player');
    expect(next.resolvedQuery).not.toContain('Curry');
    expect(next.context.recentGames).toBeUndefined();
    expect(resolveScoutTurn(DEMO_DATA, '教我做一道菜', first.context).context.playerIds).toEqual([]);
  });

  it('offers follow-ups that actually match the conversation entities', () => {
    const context = resolveScoutTurn(DEMO_DATA, '比较库里和詹姆斯').context;
    const suggestions = getScoutFollowUps(DEMO_DATA, context, false);
    expect(suggestions.map((item) => item.label)).toContain('查看直接对位');
    const follow = resolveScoutTurn(DEMO_DATA, suggestions[0].query, context);
    expect(follow.context.playerIds).toEqual(context.playerIds);
  });
});
