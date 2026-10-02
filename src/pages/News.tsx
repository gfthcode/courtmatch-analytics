import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Filter, Newspaper, RefreshCw, Search } from 'lucide-react';
import { PageHead } from '../components/Common';
import { Button } from '../components/ui/button';
import { useLanguage } from '../i18n';
import './news.css';

const NEWS_URL = `${import.meta.env.BASE_URL}data/news.json`;
const CACHE_KEY = 'courtmatch-nba-news-v1';
const CACHE_TTL = 10 * 60 * 1000;
const ZH_CACHE_KEY = 'courtmatch-nba-news-zh-v1';

type NewsItem = { id: string; title: string; summary: string; titleZh?: string; summaryZh?: string; url: string; publishedAt: string; image?: string; authors: string[]; category: 'court' | 'off-court' | 'general' };
type NewsTranslation = { title: string; summary: string };
type RawArticle = Record<string, unknown>;

function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function classify(article: RawArticle, title: string, summary: string): NewsItem['category'] {
  const tags = Array.isArray(article.categories) ? article.categories.map((item) => text((item as RawArticle)?.description ?? (item as RawArticle)?.type).toLowerCase()).join(' ') : '';
  const content = `${title} ${summary} ${tags}`.toLowerCase();
  if (/injur|injured|return|surgery|suspend|trade|contract|signs? with|waived|personal|family|charity|arrest|fine|extension|自由球员|交易|续约|签约|伤病|受伤|手术|停赛|罚款|家庭|慈善|场外/.test(content)) return 'off-court';
  if (/playoff|game|scor|shot|assist|rebound|defen|win|loss|coach|series|season|performance|matchup|得分|比赛|投篮|助攻|篮板|防守|胜|教练|季后赛|赛场/.test(content)) return 'court';
  return 'general';
}
function normalize(article: RawArticle, index: number): NewsItem | null {
  const title = text(article.headline ?? article.title).trim();
  const links = article.links as RawArticle | undefined;
  const web = links?.web as RawArticle | undefined;
  const url = text(web?.href ?? article.url ?? article.link);
  if (!title || !/^https:\/\//.test(url)) return null;
  const images = Array.isArray(article.images) ? article.images as RawArticle[] : [];
  const image = text(article.image ?? images[0]?.url);
  const authors = Array.isArray(article.authors) ? article.authors.map(text).filter(Boolean) : typeof article.author === 'string' ? [article.author] : Array.isArray(article.byline) ? article.byline.map(text).filter(Boolean) : typeof article.byline === 'string' ? [article.byline] : [];
  const summary = text(article.description ?? article.summary ?? article.story).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const publishedAt = text(article.published ?? article.publishedAt ?? article.lastModified);
  const id = text(article.id ?? article.dataSourceIdentifier) || `${url}-${index}`;
  return { id, title, summary, titleZh: text(article.titleZh ?? article.title_zh).trim() || undefined, summaryZh: text(article.summaryZh ?? article.summary_zh).trim() || undefined, url, publishedAt, image: /^https:\/\//.test(image) ? image : undefined, authors, category: classify(article, title, summary) };
}
function readTranslationCache(): Record<string, NewsTranslation> {
  try {
    const value = JSON.parse(localStorage.getItem(ZH_CACHE_KEY) || '{}') as Record<string, NewsTranslation>;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function parseTranslation(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return '';
  return (payload[0] as unknown[]).map((segment) => Array.isArray(segment) ? text(segment[0]) : '').join('').trim();
}
async function translateToChinese(value: string, signal: AbortSignal): Promise<string> {
  if (!value.trim()) return '';
  const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'zh-CN', dt: 't', q: value });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
  const translated = parseTranslation(await response.json());
  if (!translated) throw new Error('Translation returned no text');
  return translated;
}
function readCache(): { items: NewsItem[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { items?: NewsItem[]; fetchedAt?: number };
    if (!Array.isArray(value.items) || typeof value.fetchedAt !== 'number') return null;
    return { items: value.items, fetchedAt: value.fetchedAt };
  } catch { return null; }
}

export function NewsPage() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [items, setItems] = useState<NewsItem[]>([]);
  const [translations, setTranslations] = useState<Record<string, NewsTranslation>>({});
  const [translationErrors, setTranslationErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'court' | 'off-court'>('all');

  const refresh = useCallback(async (force = false) => {
    const cached = readCache();
    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setItems(cached.items); setFetchedAt(cached.fetchedAt); setLoading(false); setError(''); return;
    }
    setLoading(true); setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${NEWS_URL}?_=${Date.now()}`, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { articles?: RawArticle[]; updatedAt?: string };
      const articles = Array.isArray(payload.articles) ? payload.articles : [];
      const next = articles.map(normalize).filter((item): item is NewsItem => Boolean(item)).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      if (!next.length) throw new Error('No articles in response');
      const publishedUpdate = payload.updatedAt ? Date.parse(payload.updatedAt) : Date.now();
      const time = Number.isFinite(publishedUpdate) ? publishedUpdate : Date.now();
      setItems(next); setFetchedAt(time); setError('');
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ items: next, fetchedAt: time })); } catch { /* private mode or storage quota */ }
    } catch {
      if (cached?.items.length) { setItems(cached.items); setFetchedAt(cached.fetchedAt); setError(en ? 'Live refresh failed; showing the last saved feed.' : '实时更新暂不可用，当前显示上次成功缓存的新闻。'); }
      else { setError(en ? 'Could not load the live ESPN feed. Check your connection and retry.' : '暂时无法读取 ESPN 实时新闻，请检查网络后重试。'); }
    } finally { window.clearTimeout(timeout); setLoading(false); }
  }, [en]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(true); }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (en || !items.length) return;
    const controller = new AbortController();
    const cached = readTranslationCache();
    const initial: Record<string, NewsTranslation> = {};
    for (const item of items) {
      const saved = cached[item.id];
      if (item.titleZh || item.summaryZh) initial[item.id] = { title: item.titleZh || saved?.title || '', summary: item.summaryZh || saved?.summary || '' };
      else if (saved?.title) initial[item.id] = saved;
    }
    setTranslations(initial);
    setTranslationErrors({});
    let cursor = 0;
    const worker = async () => {
      while (!controller.signal.aborted) {
        const item = items[cursor++];
        if (!item) return;
        const existing = initial[item.id];
        if (existing?.title && (!item.summary || existing.summary)) continue;
        try {
          let title = item.titleZh || '';
          let summary = item.summaryZh || '';
          if (!title && !summary && item.summary) {
            const combined = await translateToChinese(`${item.title}\n\n${item.summary}`, controller.signal);
            const parts = combined.split(/\n\s*\n/, 2);
            if (parts.length === 2) [title, summary] = parts.map((part) => part.trim());
          }
          if (!title) title = await translateToChinese(item.title, controller.signal);
          if (!summary && item.summary) summary = await translateToChinese(item.summary, controller.signal);
          const result = { title, summary };
          initial[item.id] = result;
          setTranslations((current) => ({ ...current, [item.id]: result }));
          cached[item.id] = result;
          const entries = Object.entries(cached).slice(-150);
          try { localStorage.setItem(ZH_CACHE_KEY, JSON.stringify(Object.fromEntries(entries))); } catch { /* private mode or storage quota */ }
        } catch {
          if (!controller.signal.aborted) setTranslationErrors((current) => ({ ...current, [item.id]: true }));
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, items.length) }, () => worker()));
    return () => controller.abort();
  }, [en, items]);
  const shown = useMemo(() => items.filter((item) => {
    const matchesFilter = filter === 'all' || item.category === filter || item.category === 'general';
    const needle = query.trim().toLocaleLowerCase();
    const translated = translations[item.id];
    const matchesQuery = !needle || `${item.title} ${item.summary} ${translated?.title || ''} ${translated?.summary || ''} ${item.authors.join(' ')}`.toLocaleLowerCase().includes(needle);
    return matchesFilter && matchesQuery;
  }), [items, filter, query, translations]);
  const relativeTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return en ? 'Time unavailable' : '时间暂缺';
    return new Intl.DateTimeFormat(en ? 'en-US' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  const lastRefresh = fetchedAt ? relativeTime(new Date(fetchedAt).toISOString()) : '';

  return <div className="news-page">
    <PageHead eyebrow="NBA NEWS DESK" title={en ? 'NBA News' : 'NBA 新闻'} description={en ? 'Daily on-court and off-court stories about NBA players, with direct links to the original reporting.' : '每日汇集 NBA 球员场内表现与场外动态，并直达原始报道来源。'}>
      <Button variant="secondary" onClick={() => void refresh(true)} disabled={loading}><RefreshCw size={15} className={loading ? 'news-spinning' : ''} />{en ? 'Refresh' : '刷新新闻'}</Button>
    </PageHead>
    <div className="news-source-note"><span className="news-source-mark">ESPN</span><span><strong>{en ? 'Live source: ESPN NBA' : '实时来源：ESPN NBA'}</strong><small>{en ? `Feed checked on demand · Last successful update ${lastRefresh || '—'}` : `按需读取新闻源 · 最近成功更新 ${lastRefresh || '—'}`}</small></span><a href="https://www.espn.com/nba/" target="_blank" rel="noreferrer">{en ? 'Source' : '来源'} <ExternalLink size={13}/></a></div>
    <div className="news-toolbar">
      <label className="news-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? 'Search players or headlines' : '搜索球员或新闻标题'} aria-label={en ? 'Search NBA news' : '搜索 NBA 新闻'} /></label>
      <div className="news-filters" role="group" aria-label={en ? 'News category' : '新闻类别'}><Filter size={15}/>{([['all', en ? 'All' : '全部'], ['court', en ? 'On-court' : '场内'], ['off-court', en ? 'Off-court' : '场外']] as const).map(([key, label]) => <button key={key} className={filter === key ? 'is-selected' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
    </div>
    {error && <div className={`news-alert${items.length ? ' is-stale' : ''}`} role="status">{error}{!items.length && <Button variant="secondary" onClick={() => void refresh(true)}>{en ? 'Retry' : '重试'}</Button>}</div>}
    {loading && !items.length ? <div className="news-loading" role="status"><span className="news-pulse"/><span>{en ? 'Loading the latest NBA stories…' : '正在读取最新 NBA 新闻…'}</span></div> : shown.length ? <section className="news-grid" aria-label={en ? 'Latest NBA stories' : '最新 NBA 新闻'}>{shown.map((item) => <article className="news-card" key={item.id}>
      {item.image && <a className="news-image" href={item.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true"><img src={item.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.remove(); }} /></a>}
      <div className="news-card-content"><div className="news-card-meta"><span className={`news-category news-category-${item.category}`}>{item.category === 'off-court' ? (en ? 'OFF COURT' : '场外动态') : item.category === 'court' ? (en ? 'ON COURT' : '场内动态') : (en ? 'NBA' : '联盟新闻')}</span><time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time></div><h2><a href={item.url} target="_blank" rel="noreferrer">{en ? item.title : translations[item.id]?.title || (translationErrors[item.id] ? '标题翻译暂不可用' : '正在翻译标题…')}</a></h2>{item.summary && <p>{en ? item.summary : translations[item.id]?.summary || (translationErrors[item.id] ? '摘要翻译暂不可用，可点击“阅读原文”查看完整报道。' : '正在翻译新闻摘要…')}</p>}<footer><span>{item.authors[0] || 'ESPN'}</span><a href={item.url} target="_blank" rel="noreferrer">{en ? 'Read original' : '阅读原文'} <ExternalLink size={13}/></a></footer></div>
    </article>)}</section> : !loading && <section className="news-empty"><Newspaper size={28}/><h2>{items.length ? (en ? 'No stories match this filter' : '没有符合条件的新闻') : (en ? 'No news available' : '暂无新闻')}</h2><p>{items.length ? (en ? 'Try another keyword or category.' : '试试更换关键词或分类。') : (en ? 'The live feed has not returned any stories yet.' : '新闻源暂未返回新闻内容。')}</p></section>}
    <p className="news-disclaimer">{en ? 'On-court / off-court labels are automatically inferred from headline and summary keywords. Stories remain attributed to and hosted by their original publishers.' : '场内 / 场外标签根据标题与摘要关键词自动归类，仅供浏览筛选；新闻内容及版权均归原始发布方所有。'}</p>
  </div>;
}
