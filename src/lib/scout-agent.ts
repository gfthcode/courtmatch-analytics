import type { Dataset, Player, PlayerStats } from './types';
import type { ScoutResult } from './scout';
import { scoutSourceNote } from './scout-provenance';

const text = (zh: string, en: string, english: boolean) => english ? en : zh;
const rate = (value: number | null | undefined, decimals = 1) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(decimals);
const currentSeason = (data: Dataset) => [...new Set([...data.seasons, ...data.playerStats.map((row) => row.season)])].sort().reverse()[0] ?? '';

function latestRows(data: Dataset, season: string): Map<string, PlayerStats> {
  const rows = new Map<string, PlayerStats>();
  for (const row of data.playerStats) {
    if (row.season !== season || row.seasonType !== 'regular') continue;
    const existing = rows.get(row.playerId);
    if (!existing || row.gamesPlayed > existing.gamesPlayed) rows.set(row.playerId, row);
  }
  return rows;
}

export function buildWatchlistReport(data: Dataset, playerIds: string[], english: boolean): ScoutResult {
  const season = currentSeason(data);
  const current = latestRows(data, season);
  const previousSeason = [...new Set(data.playerStats.map((row) => row.season))].filter((candidate) => candidate < season).sort().reverse()[0];
  const previous = previousSeason ? latestRows(data, previousSeason) : new Map<string, PlayerStats>();
  const playersById = new Map(data.players.map((player) => [player.id, player]));
  const selected = [...new Set(playerIds)].map((id) => playersById.get(id)).filter((player): player is Player => Boolean(player));
  if (!selected.length) return {
    title: text('关注球员变化', 'Player watchlist', english),
    body: text('还没有关注球员。先搜索并添加球员，再生成变化简报。关注清单只保存在当前浏览器。', 'Your watchlist is empty. Search and add players, then generate a change brief. The list is stored in this browser only.', english),
    action: { label: text('打开球员目录', 'Open player directory', english), href: '/players' },
  };

  const reports = selected.map((player) => {
    const now = current.get(player.id);
    const before = previous.get(player.id);
    const logs = (data.daily ?? []).filter((row) => row.playerId === player.id && row.season === season && row.seasonType === 'regular')
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const recentPoints = logs.length ? logs.reduce((total, game) => total + game.points, 0) / logs.length : null;
    const recentDelta = recentPoints != null && now ? recentPoints - now.pointsPerGame : null;
    const seasonDelta = now && before ? now.pointsPerGame - before.pointsPerGame : null;
    const lines = [`${player.shortName} · ${player.teamAbbreviation} · ${player.position}`];
    if (now) lines.push(text(`本季场均 ${rate(now.pointsPerGame)} 分 / ${rate(now.reboundsPerGame)} 篮板 / ${rate(now.assistsPerGame)} 助攻（${now.gamesPlayed} 场）`, `Season: ${rate(now.pointsPerGame)} PPG / ${rate(now.reboundsPerGame)} RPG / ${rate(now.assistsPerGame)} APG (${now.gamesPlayed} games)`, english));
    else lines.push(text(`当前 ${season} 球员统计快照不可用。`, `The ${season} player-stat snapshot is unavailable.`, english));
    if (recentPoints != null && now) lines.push(text(`最近 ${logs.length} 场场均 ${rate(recentPoints)} 分，较本季均值 ${recentDelta! >= 0 ? '+' : ''}${rate(recentDelta)} 分；比赛日志更新至 ${logs[0].date}。`, `Last ${logs.length} games: ${rate(recentPoints)} PPG, ${recentDelta! >= 0 ? '+' : ''}${rate(recentDelta)} vs season average; game logs through ${logs[0].date}.`, english));
    else lines.push(text('当前发布目录没有该球员最近比赛日志，暂时无法计算近况差异。', 'No recent game logs are published for this player, so a recent-form delta is unavailable.', english));
    if (seasonDelta != null) lines.push(text(`与 ${previousSeason} 常规赛场均得分相比：${seasonDelta >= 0 ? '+' : ''}${rate(seasonDelta)} 分。`, `Compared with ${previousSeason} regular-season scoring: ${seasonDelta >= 0 ? '+' : ''}${rate(seasonDelta)} PPG.`, english));
    return lines.join('\n');
  });
  const note = data.manifest.status === 'stale'
    ? text('数据目录当前标记为待更新/过期；此简报不是实时推送。', 'The published dataset is marked stale; this is not a live alert.', english)
    : text('这是当前已发布快照，不是后台监控或实时通知。', 'This uses the current published snapshot; it is not background monitoring or a live alert.', english);
  return {
    title: text('关注球员 · 变化简报', 'Watchlist · change brief', english),
    body: `${reports.join('\n\n')}\n\n${text(`本地关注 ${selected.length} 人 · ${season} · ${note}`, `Tracking ${selected.length} locally saved player(s) · ${season} · ${note}`, english)}\n${scoutSourceNote(data, 'player', season, english)}`,
    action: { label: text('查看球员数据', 'View player data', english), href: '/players' },
  };
}

export type FitMetric = 'shooting' | 'playmaking' | 'scoring' | 'rebounding' | 'defense';
export type FitWeights = Record<FitMetric, number>;
type Candidate = { player: Player; stats: PlayerStats; values: Record<FitMetric, number | null>; score: number };
const metricLabels: Record<FitMetric, [string, string]> = {
  shooting: ['三分命中率', '3P%'], playmaking: ['助攻', 'APG'], scoring: ['得分', 'PPG'],
  rebounding: ['篮板', 'RPG'], defense: ['抢断+盖帽', 'STL+BLK'],
};

export function buildLineupFitReport(data: Dataset, query: string, english: boolean, selectedWeights?: FitWeights): ScoutResult {
  const season = currentSeason(data);
  const allStats = latestRows(data, season);
  const playersById = new Map(data.players.map((player) => [player.id, player]));
  const qualified = [...allStats.entries()].flatMap(([id, stats]) => {
    const player = playersById.get(id);
    if (!player || stats.gamesPlayed < 10) return [];
    return [{ player, stats }];
  });
  if (!qualified.length) return {
    title: text('阵容搭配探索', 'Lineup fit explorer', english),
    body: text('当前赛季没有足够的球员统计快照，无法进行候选排序。', 'There are not enough player-stat snapshots for this season to rank candidates.', english),
    action: { label: text('查看数据来源', 'View data sources', english), href: '/sources' },
  };

  const wantsShooting = /空间|投射|三分|投篮|shoot|spacing|three|3p/i.test(query);
  const wantsPlaymaking = /组织|助攻|传球|playmak|assist/i.test(query);
  const wantsScoring = /得分|进攻|score|scoring|offense/i.test(query);
  const wantsRebounding = /篮板|rebound/i.test(query);
  const wantsDefense = /防守|护框|盖帽|抢断|defen|block|steal/i.test(query);
  const requested: FitMetric[] = [
    ...(wantsShooting ? ['shooting' as const] : []), ...(wantsPlaymaking ? ['playmaking' as const] : []),
    ...(wantsScoring ? ['scoring' as const] : []), ...(wantsRebounding ? ['rebounding' as const] : []),
    ...(wantsDefense ? ['defense' as const] : []),
  ];
  const baseMetrics: FitMetric[] = requested.length ? requested : ['shooting', 'playmaking', 'rebounding', 'defense'];
  const metrics = baseMetrics.filter((metric) => !selectedWeights || selectedWeights[metric] > 0);
  if (!metrics.length) return {
    title: text('阵容搭配探索 · 请设置权重', 'Lineup fit · set a weight', english),
    body: text('当前筛选指标的权重都为 0。请把至少一项调到大于 0，再生成候选名单。', 'All selected signals have zero weight. Increase at least one above zero to rank candidates.', english),
  };
  const valuesFor = (stats: PlayerStats): Record<FitMetric, number | null> => ({
    shooting: stats.threePointPercentage ?? null,
    playmaking: stats.assistsPerGame ?? null,
    scoring: stats.pointsPerGame,
    rebounding: stats.reboundsPerGame,
    defense: stats.stealsPerGame + stats.blocksPerGame,
  });
  const raw = qualified.map(({ player, stats }) => ({ player, stats, values: valuesFor(stats) }));
  const ranges = new Map(metrics.map((metric) => {
    const values = raw.map((row) => row.values[metric]).filter((value): value is number => value != null && Number.isFinite(value));
    return [metric, { min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 }] as const;
  }));
  const candidates: Candidate[] = raw.map((row) => {
    let total = 0; let weights = 0;
    for (const metric of metrics) {
      const weight = selectedWeights?.[metric] ?? 1;
      const value = row.values[metric]; const range = ranges.get(metric);
      weights += weight;
      if (value == null || !range) continue;
      const normalized = range.max === range.min ? 0.5 : (value - range.min) / (range.max - range.min);
      total += normalized * weight;
    }
    return { ...row, score: weights ? total / weights : 0 };
  });
  const roles: Array<{ key: string; zh: string; en: string; accepts: (position: string) => boolean }> = [
    { key: 'guard', zh: '后卫', en: 'Guards', accepts: (position) => position.includes('G') },
    { key: 'wing', zh: '锋线', en: 'Wings', accepts: (position) => position.includes('F') },
    { key: 'big', zh: '内线', en: 'Bigs', accepts: (position) => position.includes('C') },
  ];
  const requestedRoles = new Set<string>();
  if (/后卫|控卫|分卫|guard|backcourt/i.test(query)) requestedRoles.add('guard');
  if (/锋线|前锋|wing|forward/i.test(query)) requestedRoles.add('wing');
  if (/内线|中锋|center|big/i.test(query)) requestedRoles.add('big');
  const selectedRoles = requestedRoles.size ? roles.filter((role) => requestedRoles.has(role.key)) : roles;
  const sections = selectedRoles.map((role) => {
    const rows = candidates.filter((candidate) => role.accepts(candidate.player.position)).sort((a, b) => b.score - a.score).slice(0, selectedRoles.length === 1 ? 5 : 2);
    const entries = rows.map((candidate, index) => {
      const details = metrics.map((metric) => {
        const value = candidate.values[metric];
        const display = metric === 'shooting' && value != null ? `${rate(value * 100)}%` : rate(value);
        return `${text(...metricLabels[metric], english)} ${display}`;
      }).join(' · ');
      return `${index + 1}. ${candidate.player.shortName} (${candidate.player.teamAbbreviation} / ${candidate.player.position}) — ${Math.round(candidate.score * 100)} ${text('匹配分', 'fit', english)} · ${details} · ${candidate.stats.gamesPlayed} ${text('场', 'GP', english)}`;
    });
    return `${text(role.zh, role.en, english)}\n${entries.length ? entries.join('\n') : text('当前筛选没有合格球员。', 'No qualified candidates for this role.', english)}`;
  });
  const criteria = metrics.map((metric) => `${text(...metricLabels[metric], english)} ×${rate(selectedWeights?.[metric] ?? 1)}`).join(' · ');
  return {
    title: text('阵容搭配探索 · 候选球员', 'Lineup fit · player candidates', english),
    body: `${text(`赛季：${season} 常规赛 · 筛选：${criteria} · 至少 10 场`, `Season: ${season} regular season · Signals: ${criteria} · minimum 10 games`, english)}\n\n${sections.join('\n\n')}\n\n${text('算法：在至少 10 场的候选球员池中，每项指标按最小值到最大值映射到 0–100，再按上方权重加权平均；缺失指标按 0 计。抢断+盖帽只是防守数据代理指标，三分命中率未考虑出手量。匹配分不代表球员间化学反应、真实阵容胜率或因果结论。', 'Method: among candidates with at least 10 games, each signal is min-max scaled to 0–100 and combined with the weights shown above; missing values count as zero. Steals plus blocks are only a defensive proxy, and 3P% does not account for volume. Fit is not chemistry, lineup win probability or causality.', english)}\n${scoutSourceNote(data, 'player', season, english)}`,
    action: { label: text('打开球员目录', 'Open player directory', english), href: `/players?season=${encodeURIComponent(season)}` },
  };
}
