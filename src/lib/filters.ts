import type { Filters } from './types';
import { SEASONS } from './data';

export const DEFAULT_FILTERS: Filters = {
  player: 'stephen-curry', season: '2024-25', type: 'regular', perspective: 'offense',
  team: '', opponentTeam: '', position: '', minPossessions: 25, quality: '', search: '',
  metric: 'offense', order: 'desc', page: 1,
};
export const defaultFilters = DEFAULT_FILTERS;

function safeNumber(value: string | null, fallback: number, maximum: number): number {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(0, Math.trunc(parsed))) : fallback;
}

export function parseFilters(search: URLSearchParams | string, seasons = SEASONS, defaultPlayer = DEFAULT_FILTERS.player): Filters {
  const query = typeof search === 'string' ? new URLSearchParams(search) : search;
  const season = query.get('season') || seasons[0] || DEFAULT_FILTERS.season;
  const position = query.get('position') || '';
  const quality = query.get('quality') || '';
  const metric = query.get('metric') || DEFAULT_FILTERS.metric;
  return {
    player: (query.get('player') || defaultPlayer).slice(0, 100),
    season: seasons.includes(season) ? season : seasons[0] || DEFAULT_FILTERS.season,
    type: query.get('type') === 'playoffs' ? 'playoffs' : 'regular',
    perspective: query.get('perspective') === 'defense' ? 'defense' : 'offense',
    team: (query.get('team') || '').slice(0, 40), opponentTeam: (query.get('opponentTeam') || '').slice(0, 40),
    position: ['G', 'F', 'C', 'G-F', 'F-C'].includes(position) ? position : '',
    minPossessions: safeNumber(query.get('minPossessions'), 25, 500),
    quality: ['low', 'medium', 'high'].includes(quality) ? quality : '',
    search: (query.get('search') || '').slice(0, 150),
    metric: ['offense', 'defense', 'possessions', 'edge', 'improvement', 'decline', 'stability', 'position', 'points', 'fieldGoalPercentage', 'threePointPercentage', 'turnovers', 'efficiency'].includes(metric) ? metric : 'offense',
    order: query.get('order') === 'asc' ? 'asc' : 'desc', page: Math.max(1, safeNumber(query.get('page'), 1, 10000)),
  };
}

export function filtersToSearch(filters: Partial<Filters>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  return query;
}
export const toSearch = filtersToSearch;
