import { describe, expect, it, vi } from 'vitest';
import { readScoutSession, saveScoutSession, selectScoutWorkflow, SCOUT_SESSION_KEY, type ScoutTurn } from './scout-session';

const turn = (id: string): ScoutTurn => ({ id, prompt: '库里最近5场', resolvedQuery: 'Stephen Curry 最近5场', mode: 'analysis', createdAt: '2026-10-14T01:00:00Z', status: 'complete', answers: { zh: { title: '近况', body: '统计' }, en: { title: 'Recent form', body: 'Stats' } } });
describe('Agent conversation lifecycle', () => {
  it('keeps a bounded conversation and restores both answer languages', () => {
    const setItem = vi.fn(); saveScoutSession(Array.from({ length: 20 }, (_, i) => turn(String(i))), { setItem });
    expect(setItem.mock.calls[0][0]).toBe(SCOUT_SESSION_KEY);
    const restored = readScoutSession({ getItem: () => setItem.mock.calls[0][1] });
    expect(restored).toHaveLength(12); expect(restored[0].id).toBe('8'); expect(restored[11].answers?.en.title).toBe('Recent form');
  });
  it('discards corrupt entries and unsafe stored links', () => {
    const valid = turn('1'); valid.answers!.zh.action = { label: 'Go', href: '//untrusted.invalid' }; valid.answers!.zh.sources = [{ label: 'bad', href: 'javascript:alert(1)' }];
    const restored = readScoutSession({ getItem: () => JSON.stringify([null, { mode: 'invalid' }, valid]) });
    expect(restored).toHaveLength(1); expect(restored[0].answers?.zh.action).toBeUndefined(); expect(restored[0].answers?.zh.sources).toEqual([]);
    expect(readScoutSession({ getItem: () => '{broken' })).toEqual([]);
  });
  it('recovers interrupted requests as stopped and tolerates storage failures', () => {
    const pending = { ...turn('pending'), status: 'pending', answers: undefined };
    expect(readScoutSession({ getItem: () => JSON.stringify([pending]) })[0].status).toBe('cancelled');
    expect(readScoutSession({ getItem: () => { throw new Error('blocked'); } })).toEqual([]);
    expect(() => saveScoutSession([turn('1')], { setItem: () => { throw new Error('quota'); } })).not.toThrow();
  });
  it('retains a failed refresh notice alongside the previous bilingual answer', () => {
    const saved = { ...turn('retry'), refreshFailed: true };
    const restored = readScoutSession({ getItem: () => JSON.stringify([saved]) });
    expect(restored[0].refreshFailed).toBe(true);
    expect(restored[0].answers?.zh.body).toBe('统计');
  });
  it('lets a new topic override a previously selected specialized workflow', () => {
    expect(selectScoutWorkflow('NBA 最新新闻', 'lineup')).toBe('news');
    expect(selectScoutWorkflow('库里场外', 'lineup', true)).toBe('news');
    expect(selectScoutWorkflow('Lakers off-court', null, true)).toBe('news');
    expect(selectScoutWorkflow('库里最近 5 场表现', 'watchlist')).toBe('analysis');
    expect(selectScoutWorkflow('比较库里和詹姆斯的数据', 'lineup')).toBe('analysis');
    expect(selectScoutWorkflow('寻找具备投射能力的内线', null)).toBe('lineup');
    expect(selectScoutWorkflow('只看内线', 'lineup')).toBe('lineup');
    expect(selectScoutWorkflow('詹姆斯怎么样', 'lineup', true)).toBe('analysis');
    expect(selectScoutWorkflow('Stephen Curry', 'watchlist', true)).toBe('analysis');
    expect(selectScoutWorkflow('围绕库里搭配阵容', 'analysis', true)).toBe('lineup');
  });
});
