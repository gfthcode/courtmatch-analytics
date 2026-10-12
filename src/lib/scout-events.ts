export type ScoutAgentMode = 'matchup' | 'news' | 'analysis' | 'watchlist' | 'lineup';

export const SCOUT_AGENT_OPEN_EVENT = 'courtmatch:open-agent';

export function openScoutAgent(mode?: ScoutAgentMode) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ mode?: ScoutAgentMode }>(SCOUT_AGENT_OPEN_EVENT, { detail: { mode } }));
}
