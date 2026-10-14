export type ScoutAgentMode = 'matchup' | 'news' | 'analysis' | 'watchlist' | 'lineup';

export const SCOUT_AGENT_OPEN_EVENT = 'courtmatch:open-agent';
let pendingOpen: { mode?: ScoutAgentMode } | undefined;

export function consumePendingScoutOpen(): { mode?: ScoutAgentMode } | undefined {
  const pending = pendingOpen;
  pendingOpen = undefined;
  return pending;
}

export function openScoutAgent(mode?: ScoutAgentMode) {
  if (typeof window === 'undefined') return;
  pendingOpen = { mode };
  window.dispatchEvent(new CustomEvent<{ mode?: ScoutAgentMode }>(SCOUT_AGENT_OPEN_EVENT, { detail: { mode } }));
}
