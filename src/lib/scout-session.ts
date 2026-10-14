import { isScoutNewsQuery, type ScoutResult } from './scout';
import type { FitWeights } from './scout-agent';
import type { ScoutAgentMode } from './scout-events';

export type ScoutTurn = {
  id: string;
  prompt: string;
  resolvedQuery: string;
  mode: ScoutAgentMode;
  createdAt: string;
  answers?: { zh: ScoutResult; en: ScoutResult };
  status: 'pending' | 'complete' | 'cancelled' | 'error';
  usedContext?: boolean;
  weights?: FitWeights;
  trackedIds?: string[];
  cachedNews?: boolean;
  refreshFailed?: boolean;
};

export const SCOUT_SESSION_KEY = 'cm-agent-conversation-v2';
export const SCOUT_TURN_LIMIT = 12;
const modes: ScoutAgentMode[] = ['matchup', 'news', 'analysis', 'watchlist', 'lineup'];
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const bounded = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';

function safeResult(value: unknown): ScoutResult | undefined {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.body !== 'string') return undefined;
  const action = isRecord(value.action) && typeof value.action.href === 'string' && /^\/(?!\/)/.test(value.action.href)
    ? { label: bounded(value.action.label, 180), href: bounded(value.action.href, 1000) } : undefined;
  const sources = Array.isArray(value.sources) ? value.sources.filter(isRecord)
    .filter((source) => typeof source.href === 'string' && /^https:\/\//i.test(source.href))
    .slice(0, 10).map((source) => ({ label: bounded(source.label, 240), href: bounded(source.href, 2000) })) : undefined;
  return { title: bounded(value.title, 240), body: bounded(value.body, 20000), action, sources };
}

export function readScoutSession(storage?: Pick<Storage, 'getItem'>): ScoutTurn[] {
  try {
    const raw = (storage ?? localStorage).getItem(SCOUT_SESSION_KEY);
    if (!raw || raw.length > 600000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).slice(-SCOUT_TURN_LIMIT).flatMap((turn): ScoutTurn[] => {
      if (!modes.includes(turn.mode as ScoutAgentMode) || !bounded(turn.prompt, 500) || !Number.isFinite(Date.parse(String(turn.createdAt)))) return [];
      const zh = isRecord(turn.answers) ? safeResult(turn.answers.zh) : undefined;
      const en = isRecord(turn.answers) ? safeResult(turn.answers.en) : undefined;
      const weights = isRecord(turn.weights) && ['shooting', 'playmaking', 'scoring', 'rebounding', 'defense'].every((key) => typeof (turn.weights as Record<string, unknown>)[key] === 'number' && Number.isFinite((turn.weights as Record<string, number>)[key]))
        ? Object.fromEntries(Object.entries(turn.weights).map(([key, value]) => [key, Math.max(0, Math.min(3, Number(value)))])) as FitWeights : undefined;
      return [{ id: bounded(turn.id, 100), prompt: bounded(turn.prompt, 500), resolvedQuery: bounded(turn.resolvedQuery, 1000) || bounded(turn.prompt, 500), mode: turn.mode as ScoutAgentMode,
        createdAt: String(turn.createdAt), answers: zh && en ? { zh, en } : undefined,
        status: zh && en ? 'complete' : 'cancelled', usedContext: turn.usedContext === true, cachedNews: turn.cachedNews === true, refreshFailed: turn.refreshFailed === true,
        weights, trackedIds: Array.isArray(turn.trackedIds) ? turn.trackedIds.filter((id): id is string => typeof id === 'string').slice(0, 20) : undefined }];
    });
  } catch { return []; }
}

export function saveScoutSession(turns: ScoutTurn[], storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? localStorage).setItem(SCOUT_SESSION_KEY, JSON.stringify(turns.slice(-SCOUT_TURN_LIMIT))); } catch { /* Session remains usable with restricted storage. */ }
}

export function selectScoutWorkflow(prompt: string, selected: ScoutAgentMode | null, hasExplicitEntity = false): ScoutAgentMode {
  if (isScoutNewsQuery(prompt)) return 'news';
  if (/关注|追踪|watchlist|tracked players|change brief/i.test(prompt)) return 'watchlist';
  if (/阵容搭配|搭配|候选|lineup|fit|(?:找|寻找|推荐|find).*(?:后卫|前锋|锋线|内线|中锋|投射|guard|forward|wing|big|center|shoot)/i.test(prompt)) return 'lineup';
  if (/对比|比较|对位|排行|排名|榜|最近.*场|近\s*\d+\s*场|数据|新闻|compare|matchup|rank|stats|last\s*\d+\s*games/i.test(prompt)) return 'analysis';
  if (hasExplicitEntity) return 'analysis';
  return selected ?? 'analysis';
}
