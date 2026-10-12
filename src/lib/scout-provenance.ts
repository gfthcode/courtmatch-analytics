import type { Dataset, SampleQuality } from './types';

type SourceKind = 'matchup' | 'player' | 'team' | 'playerPlaytype' | 'teamPlaytype';

const label = (chinese: string, english: string, useEnglish: boolean) => useEnglish ? english : chinese;
const date = (value?: string) => value?.slice(0, 10) || null;

export function sampleLabel(quality: SampleQuality, english: boolean): string {
  if (quality === 'high') return label('高样本', 'high sample', english);
  if (quality === 'medium') return label('中样本', 'medium sample', english);
  return label('低样本', 'low sample', english);
}

export function scoutSourceNote(data: Dataset, source: SourceKind, season: string, english: boolean): string {
  const manifest = data.manifest;
  const snapshot = date(source === 'playerPlaytype' ? manifest.playerPlaytypesSourceUpdatedAt
    : source === 'teamPlaytype' ? manifest.teamPlaytypesSourceUpdatedAt
      : source === 'team' ? manifest.teamStatsSourceUpdatedAt
        : source === 'player' ? manifest.playerStatsSourceUpdatedAt
          : manifest.lastUpdated || data.updatedAt);
  const through = source === 'player' ? date(manifest.nbaStatsDataThrough) : null;
  const sourceName = source === 'matchup' ? label('直接对位记录', 'direct matchup records', english)
    : source === 'player' ? label('球员赛季统计', 'player season stats', english)
      : source === 'team' ? label('球队效率快照', 'team ratings snapshot', english)
        : label('打法快照', 'play-type snapshot', english);
  const status = manifest.status === 'stale'
    ? label('目录标记为过期/待验证', 'catalogue marked stale or pending verification', english)
    : data.mode === 'demo' ? label('演示数据', 'demo data', english)
      : label('已发布数据', 'published data', english);
  const period = season ? `${season} · ` : '';
  return english
    ? `Source: ${period}${sourceName}; snapshot ${snapshot ?? 'date unverified'}${through ? `; last recorded game ${through}` : ''}; ${status}. Not live.`
    : `数据口径：${period}${sourceName}；快照${snapshot ? `更新于 ${snapshot}` : '日期未核验'}${through ? `；比赛记录截止 ${through}` : ''}；${status}，非实时。`;
}
