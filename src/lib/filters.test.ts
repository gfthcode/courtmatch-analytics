import { describe, expect, it } from 'vitest';
import { normalizePossessions, parseFilters, possessionSteps } from './filters';

describe('comparison and matchup filter controls', () => {
  it('normalizes the possessions slider to the reference steps', () => {
    expect(possessionSteps).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(normalizePossessions(31)).toBe(30);
    expect(normalizePossessions(48)).toBe(50);
  });

  it('restores URL display and avatar state while keeping NBA-only positions', () => {
    const filters = parseFilters('?season=2025-26&minPossessions=47&displayMode=fill&avatarSize=large&position=Unknown', ['2025-26'], 'player-1');
    expect(filters.minPossessions).toBe(45);
    expect(filters.displayMode).toBe('fill');
    expect(filters.avatarSize).toBe('large');
    expect(filters.position).toBe('Unknown');
  });
});
