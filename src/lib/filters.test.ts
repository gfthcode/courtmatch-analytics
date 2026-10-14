import { describe, expect, it } from 'vitest';
import { getPossessionControlSteps, normalizePossessions, parseFilters, possessionSteps } from './filters';

describe('comparison and matchup filter controls', () => {
  it('normalizes the possessions slider to the reference steps', () => {
    expect(possessionSteps).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(normalizePossessions(31)).toBe(30);
    expect(normalizePossessions(48)).toBe(50);
  });

  it('restores URL display and avatar state while keeping NBA-only positions', () => {
    const filters = parseFilters('?season=2025-26&minPossessions=47&displayMode=fill&avatarSize=large&position=Unknown', ['2025-26'], 'player-1');
    expect(filters.minPossessions).toBe(47);
    expect(filters.displayMode).toBe('fill');
    expect(filters.avatarSize).toBe('large');
    expect(filters.position).toBe('Unknown');
  });

  it('keeps Agent link thresholds exact and makes their values selectable', () => {
    for (const value of [0, 25, 47, 100, 175, 1000]) {
      const parsed = parseFilters(`?minPossessions=${value}`);
      expect(parsed.minPossessions).toBe(value);
      expect(getPossessionControlSteps(parsed.minPossessions)).toContain(value);
    }
    expect(parseFilters('?minPossessions=-3').minPossessions).toBe(0);
    expect(parseFilters('?minPossessions=2000').minPossessions).toBe(1000);
    expect(parseFilters('?minPossessions=invalid').minPossessions).toBe(30);
    expect(getPossessionControlSteps(47)).toEqual([...getPossessionControlSteps(47)].sort((a, b) => a - b));
  });
});
