import { describe, expect, it } from 'vitest';
import { teamOptionLabel } from './team-display';

describe('teamOptionLabel', () => {
  it('does not repeat a team abbreviation when source names fall back to the abbreviation', () => {
    const team = { abbreviation: 'HOU', name: 'HOU', chineseName: 'HOU' };
    expect(teamOptionLabel(team, 'zh')).toBe('HOU');
    expect(teamOptionLabel(team, 'en')).toBe('HOU');
  });

  it('keeps the abbreviation and localized name when the source name is available', () => {
    const team = { abbreviation: 'BOS', name: 'Boston Celtics', chineseName: '波士顿凯尔特人' };
    expect(teamOptionLabel(team, 'zh')).toBe('BOS · 波士顿凯尔特人');
    expect(teamOptionLabel(team, 'en')).toBe('BOS · Boston Celtics');
  });
});
