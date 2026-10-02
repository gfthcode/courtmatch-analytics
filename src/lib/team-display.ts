import type { Team } from './types';

export function teamOptionLabel(team: Pick<Team, 'abbreviation' | 'name' | 'chineseName'>, language: 'en' | 'zh'): string {
  const abbreviation = team.abbreviation.trim();
  const name = (language === 'en' ? team.name : team.chineseName).trim();
  if (!name || name.localeCompare(abbreviation, undefined, { sensitivity: 'accent' }) === 0) return abbreviation;
  return `${abbreviation} · ${name}`;
}
