export type NewsTranslation = { title: string; summary: string; sourceText?: string };

const ZH_CACHE_KEY = 'courtmatch-nba-news-zh-v1';

function text(value: unknown): string { return typeof value === 'string' ? value : ''; }

export function readNewsTranslationCache(): Record<string, NewsTranslation> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ZH_CACHE_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([id, entry]) => {
      if (!id || !entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.title !== 'string' || !candidate.title.trim() || typeof candidate.summary !== 'string') return [];
      return [[id, { title: candidate.title, summary: candidate.summary,
        ...(typeof candidate.sourceText === 'string' ? { sourceText: candidate.sourceText } : {}) }]];
    }).slice(-150));
  } catch { return {}; }
}

export function saveNewsTranslation(id: string, translation: NewsTranslation): void {
  if (!id || typeof translation.title !== 'string' || !translation.title.trim() || typeof translation.summary !== 'string') return;
  const cache = readNewsTranslationCache();
  delete cache[id];
  cache[id] = translation;
  try { localStorage.setItem(ZH_CACHE_KEY, JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-150)))); }
  catch { /* Keep the current response usable when storage is unavailable. */ }
}

function parseTranslation(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return '';
  return (payload[0] as unknown[]).map((segment) => Array.isArray(segment) ? text(segment[0]) : '').join('').trim();
}

export async function translateNewsTextToChinese(value: string, signal: AbortSignal): Promise<string> {
  if (!value.trim()) return '';
  const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'zh-CN', dt: 't', q: value });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
  const translated = parseTranslation(await response.json());
  if (!translated) throw new Error('Translation returned no text');
  return translated;
}

export async function translateNewsToChinese(title: string, summary: string, signal: AbortSignal): Promise<NewsTranslation> {
  if (!summary.trim()) return { title: await translateNewsTextToChinese(title, signal), summary: '' };
  try {
    const combined = await translateNewsTextToChinese(`${title}\n\n${summary}`, signal);
    const parts = combined.split(/\n\s*\n/, 2).map((part) => part.trim());
    if (parts.length === 2 && parts.every(Boolean)) return { title: parts[0], summary: parts[1] };
  } catch (error) {
    if (signal.aborted) throw error;
  }
  const [translatedTitle, translatedSummary] = await Promise.all([
    translateNewsTextToChinese(title, signal),
    translateNewsTextToChinese(summary, signal),
  ]);
  return { title: translatedTitle, summary: translatedSummary };
}
