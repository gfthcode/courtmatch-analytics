import type { ScoutNewsArticle, ScoutNewsFeed } from './scout';
import { readNewsTranslationCache, saveNewsTranslation, translateNewsToChinese } from './news-translation';

const CACHE_KEY = 'courtmatch-scout-news-v1';
const CACHE_TTL = 5 * 60 * 1_000;
type CachedFeed = { feed: ScoutNewsFeed; fetchedAt: number };
let memoryCache: CachedFeed | undefined;

function abortError(): DOMException { return new DOMException('The request was cancelled.', 'AbortError'); }
function throwIfAborted(signal: AbortSignal): void { if (signal.aborted) throw abortError(); }
function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function nonempty(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
const sourceText = (article: ScoutNewsArticle) => `${article.title}\n${article.summary ?? ''}`;

function validateFeed(value: unknown): ScoutNewsFeed | undefined {
  const payload = object(value);
  if (!payload || !Array.isArray(payload.articles)) return;
  const ids = new Set<string>();
  const urls = new Set<string>();
  const articles: ScoutNewsArticle[] = [];
  for (const value of payload.articles) {
    const row = object(value);
    if (!row) continue;
    const id = nonempty(row.id); const title = nonempty(row.title); const publishedAt = nonempty(row.publishedAt);
    if (!id || !title || !publishedAt || !Number.isFinite(Date.parse(publishedAt))) continue;
    let url: URL;
    try { url = new URL(String(row.url)); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    url.hash = '';
    if (ids.has(id) || urls.has(url.href)) continue;
    ids.add(id); urls.add(url.href);
    articles.push({
      id, title, publishedAt, url: url.href,
      summary: typeof row.summary === 'string' ? row.summary : undefined,
      titleZh: nonempty(row.titleZh), summaryZh: nonempty(row.summaryZh), author: nonempty(row.author),
      categories: Array.isArray(row.categories) ? row.categories.filter((category): category is string => typeof category === 'string') : undefined,
    });
  }
  if (!articles.length) return;
  const updatedAt = nonempty(payload.updatedAt);
  return {
    source: nonempty(payload.source),
    updatedAt: updatedAt && Number.isFinite(Date.parse(updatedAt)) ? updatedAt : undefined,
    articles: articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 150),
  };
}

function withTranslations(feed: ScoutNewsFeed): ScoutNewsFeed {
  const translations = readNewsTranslationCache();
  return { ...feed, articles: feed.articles.map((article) => {
    const saved = translations[article.id];
    // Article IDs can stay the same when a publisher revises a headline or summary.
    if (!saved || saved.sourceText !== sourceText(article)) return article;
    return { ...article, titleZh: article.titleZh || saved.title, summaryZh: article.summaryZh || saved.summary };
  }) };
}

function readCachedFeed(): CachedFeed | undefined {
  try {
    const saved = object(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
    const feed = saved && validateFeed(saved.feed);
    const fetchedAt = saved?.fetchedAt;
    if (feed && typeof fetchedAt === 'number' && Number.isFinite(fetchedAt) && fetchedAt > 0 && fetchedAt <= Date.now()
      && (!memoryCache || fetchedAt > memoryCache.fetchedAt)) memoryCache = { feed, fetchedAt };
  } catch { /* In-memory results remain usable if browser storage is blocked. */ }
  return memoryCache;
}

function storeFeed(feed: ScoutNewsFeed, fetchedAt: number): void {
  memoryCache = { feed, fetchedAt };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache)); } catch { /* Cache persistence is optional. */ }
}

function timedSignal(parent: AbortSignal, milliseconds: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  if (parent.aborted) abort();
  const timeout = globalThis.setTimeout(abort, milliseconds);
  return { signal: controller.signal, dispose: () => { globalThis.clearTimeout(timeout); parent.removeEventListener('abort', abort); } };
}

export async function loadScoutNews({ signal, force = false }: { signal: AbortSignal; force?: boolean }): Promise<{ feed: ScoutNewsFeed; cached: boolean; refreshFailed: boolean }> {
  throwIfAborted(signal);
  const saved = readCachedFeed();
  if (!force && saved && Date.now() - saved.fetchedAt < CACHE_TTL) return { feed: withTranslations(saved.feed), cached: true, refreshFailed: false };
  const request = timedSignal(signal, 8_000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/news.json?_=${Date.now()}`, {
      signal: request.signal, cache: 'no-store', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`News HTTP ${response.status}`);
    const feed = validateFeed(await response.json());
    throwIfAborted(signal);
    throwIfAborted(request.signal);
    if (!feed) throw new Error('No valid published NBA news is available.');
    storeFeed(feed, Date.now());
    return { feed: withTranslations(feed), cached: false, refreshFailed: false };
  } catch (error) {
    // Cancellation is deliberate; never turn it into an old cached answer.
    throwIfAborted(signal);
    if (saved) return { feed: withTranslations(saved.feed), cached: true, refreshFailed: true };
    throw error;
  } finally { request.dispose(); }
}

export async function translateScoutNews(
  feed: ScoutNewsFeed,
  sourceUrls: string[],
  signal: AbortSignal,
  onProgress?: (feed: ScoutNewsFeed) => void,
): Promise<ScoutNewsFeed> {
  throwIfAborted(signal);
  let current = withTranslations(feed);
  const urls = new Set(sourceUrls);
  const matching = current.articles.filter((article) => urls.has(article.url) && (!article.titleZh || (article.summary && !article.summaryZh)));
  const publish = () => {
    throwIfAborted(signal);
    // Keep the current feed identity and fetched-at time; translation is not a source refresh.
    if (memoryCache) {
      const byId = new Map(current.articles.map((article) => [article.id, article]));
      const next = { ...memoryCache.feed, articles: memoryCache.feed.articles.map((article) => {
        const translated = byId.get(article.id);
        return translated && sourceText(translated) === sourceText(article)
          ? { ...article, titleZh: article.titleZh || translated.titleZh, summaryZh: article.summaryZh || translated.summaryZh }
          : article;
      }) };
      storeFeed(next, memoryCache.fetchedAt);
    }
    onProgress?.(current);
  };
  publish();
  if (!matching.length) return current;
  const request = timedSignal(signal, 12_000);
  let cursor = 0;
  try {
    const worker = async () => {
      while (!request.signal.aborted) {
        const article = matching[cursor++];
        if (!article) return;
        try {
          const translated = await translateNewsToChinese(article.title, article.summary ?? '', request.signal);
          throwIfAborted(signal);
          if (request.signal.aborted) return;
          const result = { ...article, titleZh: article.titleZh || translated.title, summaryZh: article.summaryZh || translated.summary };
          saveNewsTranslation(article.id, { title: result.titleZh, summary: result.summaryZh, sourceText: sourceText(article) });
          current = { ...current, articles: current.articles.map((row) => row.id === article.id ? result : row) };
          publish();
        } catch { if (signal.aborted) return; /* Retain the source link and any translations already delivered. */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, matching.length) }, worker));
    throwIfAborted(signal);
    return current;
  } finally { request.dispose(); }
}
