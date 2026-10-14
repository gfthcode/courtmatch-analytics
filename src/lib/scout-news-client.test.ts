import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoutNewsFeed } from './scout';

const article = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, title: `NBA story ${id}`, summary: `NBA summary ${id}`, url: `https://www.espn.com/nba/story/${id}`,
  publishedAt: '2026-10-12T12:00:00Z', ...overrides,
});
const feed = (count = 1): ScoutNewsFeed => ({ source: 'ESPN', updatedAt: '2026-10-12T12:00:00Z', articles: Array.from({ length: count }, (_, index) => article(String(index + 1))) });
const json = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
const signal = () => new AbortController().signal;
const deferredFetch = (_url: unknown, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
  options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T00:00:00Z'));
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Scout published news client', () => {
  it('validates and deduplicates stories while retaining the source publication date', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ ...feed(), articles: [
      article('1'), article('1', { title: 'Duplicate ID' }), article('2', { url: article('1').url }),
      article('invalid-date', { publishedAt: 'not-a-date' }), article('insecure', { url: 'http://example.com/story' }),
      article('bad-title', { title: {} }), article('new', { publishedAt: '2026-10-13T12:00:00Z' }),
    ] }));
    vi.stubGlobal('fetch', fetch);
    const { loadScoutNews } = await import('./scout-news-client');
    const result = await loadScoutNews({ signal: signal() });
    expect(result.feed.articles.map((row) => row.id)).toEqual(['new', '1']);
    expect(result.feed.updatedAt).toBe('2026-10-12T12:00:00Z');
    expect(result).toMatchObject({ cached: false, refreshFailed: false });
  });

  it('uses a five-minute fetch TTL rather than the article publication date and refreshes on expiry', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(feed())).mockResolvedValueOnce(json({ ...feed(), updatedAt: '2026-10-14T00:06:00Z' }));
    vi.stubGlobal('fetch', fetch);
    const { loadScoutNews } = await import('./scout-news-client');
    await loadScoutNews({ signal: signal() });
    vi.advanceTimersByTime(4 * 60_000);
    expect((await loadScoutNews({ signal: signal() })).cached).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2 * 60_000);
    const next = await loadScoutNews({ signal: signal() });
    expect(next.cached).toBe(false);
    expect(next.feed.updatedAt).toBe('2026-10-14T00:06:00Z');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('restores a valid persisted feed and clearly reports a failed forced refresh', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(feed())).mockRejectedValueOnce(new TypeError('Offline'));
    vi.stubGlobal('fetch', fetch);
    let client = await import('./scout-news-client');
    await client.loadScoutNews({ signal: signal() });
    vi.resetModules();
    client = await import('./scout-news-client');
    expect((await client.loadScoutNews({ signal: signal() })).cached).toBe(true);
    const fallback = await client.loadScoutNews({ signal: signal(), force: true });
    expect(fallback).toMatchObject({ cached: true, refreshFailed: true });
    expect(fallback.feed.articles).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects explicit cancellation without returning a cached answer', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(feed())).mockImplementationOnce(deferredFetch);
    vi.stubGlobal('fetch', fetch);
    const { loadScoutNews } = await import('./scout-news-client');
    await loadScoutNews({ signal: signal() });
    const controller = new AbortController();
    const result = loadScoutNews({ signal: controller.signal, force: true });
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends a hung refresh after eight seconds and retains the last successful feed', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(feed())).mockImplementationOnce(deferredFetch);
    vi.stubGlobal('fetch', fetch);
    const { loadScoutNews } = await import('./scout-news-client');
    await loadScoutNews({ signal: signal() });
    const result = loadScoutNews({ signal: signal(), force: true });
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await result).toMatchObject({ cached: true, refreshFailed: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not cache an invalid response or crash when storage is unavailable', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Blocked'); } });
    const fetch = vi.fn().mockResolvedValueOnce(json({ articles: [{ title: 'bad' }] })).mockResolvedValueOnce(json(feed()));
    vi.stubGlobal('fetch', fetch);
    const { loadScoutNews } = await import('./scout-news-client');
    await expect(loadScoutNews({ signal: signal() })).rejects.toThrow('No valid');
    await loadScoutNews({ signal: signal() });
    expect((await loadScoutNews({ signal: signal() })).cached).toBe(true);
  });

  it('publishes translations incrementally with at most three concurrent requests and reuses them', async () => {
    const resolvers: Array<() => void> = [];
    let active = 0; let peak = 0;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      active += 1; peak = Math.max(peak, active);
      resolvers.push(() => { active -= 1; resolve(json([[['中文标题\n\n中文摘要']]])); });
    }));
    vi.stubGlobal('fetch', fetch);
    const { translateScoutNews } = await import('./scout-news-client');
    const current = feed(5);
    const progress: number[] = [];
    const result = translateScoutNews(current, current.articles.map((row) => row.url), signal(), (next) => progress.push(next.articles.filter((row) => row.titleZh).length));
    expect(fetch).toHaveBeenCalledTimes(3);
    for (let index = 0; index < 5; index += 1) {
      resolvers[index]();
      await vi.advanceTimersByTimeAsync(0);
    }
    const translated = await result;
    expect(peak).toBe(3);
    expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
    expect(translated.articles.every((row) => row.titleZh === '中文标题')).toBe(true);
    const repeated = await translateScoutNews(current, current.articles.map((row) => row.url), signal());
    expect(repeated.articles.every((row) => row.summaryZh === '中文摘要')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('does not reuse a cached translation for a revised source article', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json([[['旧标题\n\n旧摘要']]])).mockResolvedValueOnce(json([[['新标题\n\n新摘要']]]));
    vi.stubGlobal('fetch', fetch);
    const { translateScoutNews } = await import('./scout-news-client');
    const current = feed();
    await translateScoutNews(current, [current.articles[0].url], signal());
    const revised = { ...current, articles: [{ ...current.articles[0], title: 'Updated headline' }] };
    const result = await translateScoutNews(revised, [revised.articles[0].url], signal());
    expect(result.articles[0].titleZh).toBe('新标题');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cancels translations and leaves the already delivered source links available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(deferredFetch));
    const { translateScoutNews } = await import('./scout-news-client');
    const controller = new AbortController();
    const current = feed();
    const progress = vi.fn();
    const result = translateScoutNews(current, [current.articles[0].url], controller.signal, progress);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls[0][0].articles[0].url).toBe(current.articles[0].url);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns untranslated stories after the translation deadline without losing source data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(deferredFetch));
    const { translateScoutNews } = await import('./scout-news-client');
    const current = feed();
    const result = translateScoutNews(current, [current.articles[0].url], signal());
    await vi.advanceTimersByTimeAsync(12_000);
    expect((await result).articles[0]).toMatchObject(current.articles[0]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores malformed translation entries instead of passing objects to rendering', async () => {
    localStorage.setItem('courtmatch-nba-news-zh-v1', JSON.stringify({ valid: { title: '标题', summary: '摘要' }, bad: { title: {}, summary: '摘要' }, missing: { title: '标题' }, array: ['标题', '摘要'] }));
    const { readNewsTranslationCache } = await import('./news-translation');
    expect(readNewsTranslationCache()).toEqual({ valid: { title: '标题', summary: '摘要' } });
  });
});
