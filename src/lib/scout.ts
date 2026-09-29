import {
  aggregateRecords,
  calculateMatchupMetrics,
  getHeadToHeadMatchup,
  getPlayerPlayTypes,
  getPlayerStats,
  getRankings,
  getSampleQuality,
  searchPlayers,
  getTeamPlayTypes,
  getTeamStats,
} from './api';
import type { Dataset, Player, SeasonType, Team } from './types';

export type ScoutAction = { label: string; href: string };
export type ScoutResult = { title: string; body: string; action?: ScoutAction };

const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\s·.'’-]/g, '');
const zh = (text: string, en: string, english: boolean) => english ? en : text;
const encoded = (value: string) => encodeURIComponent(value);

function resolvePlayers(data: Dataset, query: string): Player[] {
  const normalized = normalize(query);
  const variants = data.players.flatMap((player) => [player.name, player.shortName, player.chineseName, ...player.aliases]
    .filter(Boolean).map((name) => ({ player, name: normalize(name) })))
    .sort((a, b) => b.name.length - a.name.length);
  const found = new Map<string, Player>();
  for (const { player, name } of variants) {
    if (name.length > 1 && normalized.includes(name)) found.set(player.id, player);
  }
  return [...found.values()];
}

function resolveTeams(data: Dataset, query: string): Team[] {
  const normalized = normalize(query);
  const found = new Map<string, Team>();
  for (const team of data.teams) {
    const names = [team.name, team.chineseName, team.abbreviation, team.id].map(normalize).sort((a, b) => b.length - a.length);
    if (names.some((name) => name.length > 1 && normalized.includes(name))) found.set(team.id, team);
  }
  return [...found.values()];
}

function period(query: string, data: Dataset) {
  const requestedSeason = query.match(/20\d{2}-\d{2}/)?.[0];
  const season = requestedSeason && data.seasons.includes(requestedSeason) ? requestedSeason : [...data.seasons].sort().reverse()[0] ?? '';
  const type: SeasonType = /季后赛|playoffs?|postseason/i.test(query) ? 'playoffs' : 'regular';
  const minimum = Number(query.match(/(?:至少|不低于|minimum|min(?:imum)?\s*)(\d{1,4})\s*(?:回合|possessions?|possession)?/i)?.[1] ?? 25);
  return { season, type, minimum: Math.max(0, Math.min(1000, minimum)) };
}

const safeRate = (value: number | null | undefined, digits = 1) => value == null ? '—' : value.toFixed(digits);

function freshness(data: Dataset, english: boolean): string {
  const status = data.manifest.status;
  if (status === 'stale') return zh(`\n\n数据提示：当前目录为过期/待验证状态，更新时间 ${data.updatedAt.slice(0, 10)}；结果只代表已发布覆盖范围。`, `\n\nData note: the catalogue is stale or pending validation (updated ${data.updatedAt.slice(0, 10)}); results only describe the published coverage.`, english);
  if (data.mode === 'demo') return zh('\n\n数据提示：当前使用演示数据，不代表官方 NBA 追踪统计。', '\n\nData note: demo data is active; it is not official NBA tracking data.', english);
  return zh(`\n\n数据更新：${data.updatedAt.slice(0, 10)}。`, `\n\nData updated: ${data.updatedAt.slice(0, 10)}.`, english);
}

function comparison(data: Dataset, players: Player[], query: string, english: boolean): ScoutResult {
  const [left, right] = players;
  const { season, type, minimum } = period(query, data);
  const result = getHeadToHeadMatchup(data, left.id, right.id, { season, type, minPossessions: minimum });
  const leftTotal = aggregateRecords(result.a);
  const rightTotal = aggregateRecords(result.b);
  const leftRate = leftTotal ? calculateMatchupMetrics(leftTotal).pointsPer100 : null;
  const rightRate = rightTotal ? calculateMatchupMetrics(rightTotal).pointsPer100 : null;
  const empty = leftRate === null && rightRate === null;
  const body = empty
    ? zh(`在 ${season} ${type === 'playoffs' ? '季后赛' : '常规赛'}，按至少 ${minimum} 回合筛选，没有找到 ${left.shortName} 与 ${right.shortName} 的直接对位记录。可以降低样本门槛或更换赛季。`, `No direct matchup rows for ${left.shortName} vs ${right.shortName} in ${season} ${type === 'playoffs' ? 'playoffs' : 'regular season'} at a ${minimum}-possession minimum. Try a lower threshold or another season.`, english)
    : [
      zh(`${left.shortName} 进攻面对 ${right.shortName}：${safeRate(leftRate)} 分 / 100 回合，${leftTotal?.matchupPossessions ?? 0} 回合（${getSampleQuality(leftTotal?.matchupPossessions ?? 0)} 样本）。`, `${left.shortName} on offense vs ${right.shortName}: ${safeRate(leftRate)} points per 100 possessions, ${leftTotal?.matchupPossessions ?? 0} possessions (${getSampleQuality(leftTotal?.matchupPossessions ?? 0)} sample).`, english),
      zh(`${right.shortName} 进攻面对 ${left.shortName}：${safeRate(rightRate)} 分 / 100 回合，${rightTotal?.matchupPossessions ?? 0} 回合（${getSampleQuality(rightTotal?.matchupPossessions ?? 0)} 样本）。`, `${right.shortName} on offense vs ${left.shortName}: ${safeRate(rightRate)} points per 100 possessions, ${rightTotal?.matchupPossessions ?? 0} possessions (${getSampleQuality(rightTotal?.matchupPossessions ?? 0)} sample).`, english),
      zh('这比较的是当前对位数据覆盖中的进攻效率，不等于球员整体攻防能力或因果结论。', 'This compares offensive efficiency in the available direct-matchup coverage; it is not a complete measure of overall ability or causality.', english),
    ].join('\n');
  return {
    title: zh(`${left.shortName} × ${right.shortName} 对位`, `${left.shortName} × ${right.shortName} matchup`, english),
    body: body + freshness(data, english),
    action: { label: zh('打开双人比较', 'Open player comparison', english), href: `/comparison?leftPlayer=${encoded(left.id)}&rightPlayer=${encoded(right.id)}&season=${encoded(season)}&type=${type}&minPossessions=${minimum}` },
  };
}

function matchupLeaders(data: Dataset, player: Player, query: string, english: boolean): ScoutResult {
  const { season, type, minimum } = period(query, data);
  const records = data.matchups.filter((row) => row.offensivePlayerId === player.id && row.season === season && row.seasonType === type && row.matchupPossessions >= minimum);
  const grouped = new Map<string, typeof records>();
  for (const record of records) grouped.set(record.defensivePlayerId, [...(grouped.get(record.defensivePlayerId) ?? []), record]);
  const playersById = new Map(data.players.map((candidate) => [candidate.id, candidate]));
  const rows = [...grouped.entries()].map(([opponentId, rows]) => {
    const aggregate = aggregateRecords(rows)!;
    return { player: playersById.get(opponentId), metric: calculateMatchupMetrics(aggregate).pointsPer100, possessions: aggregate.matchupPossessions };
  }).filter((row): row is { player: Player; metric: number; possessions: number } => Boolean(row.player && row.metric !== null));
  const restrictive = /限制|最难|最差|最弱|restrict|limit|hardest|worst|toughest/i.test(query);
  rows.sort((a, b) => restrictive ? a.metric - b.metric : b.metric - a.metric);
  const selected = rows.slice(0, 5);
  const body = selected.length
    ? selected.map((row, index) => `${index + 1}. ${row.player.shortName} — ${safeRate(row.metric)} ${zh('分 / 100 回合', 'points / 100 poss.', english)} · ${row.possessions} ${zh('回合', 'poss.', english)} · ${getSampleQuality(row.possessions)}`).join('\n')
    : zh(`在 ${season} 当前筛选和至少 ${minimum} 回合的门槛下，没有找到 ${player.shortName} 的对位记录。`, `No matchup rows found for ${player.shortName} in ${season} at the ${minimum}-possession minimum.`, english);
  return {
    title: zh(`${player.shortName} 的${restrictive ? '受限' : '进攻'}对位`, `${player.shortName} ${restrictive ? 'most-restricted' : 'offensive'} matchups`, english),
    body: body + zh('\n\n按每 100 个直接对位回合得分排序；这不是完整防守评价。', '\n\nSorted by points per 100 direct matchup possessions; this is not a complete defensive evaluation.', english) + freshness(data, english),
    action: { label: zh('打开联盟对位', 'Open matchup explorer', english), href: `/matchups?player=${encoded(player.id)}&season=${encoded(season)}&type=${type}&perspective=offense&minPossessions=${minimum}` },
  };
}

function rankings(data: Dataset, query: string, english: boolean): ScoutResult {
  const { season, type, minimum } = period(query, data);
  const defensive = /防守|限制|defen|opponent|allow/i.test(query);
  const metric = defensive ? 'defense' : 'offense';
  const rows = getRankings(data, { season, type, metric, minPossessions: minimum }).filter((row) => (metric === 'defense' ? row.defense : row.offense) !== null).slice(0, 5);
  const items = rows.map((row) => {
    const value = metric === 'defense' ? row.defense : row.offense;
      return `${row.rank}. ${row.player.shortName} (${row.player.teamAbbreviation}) — ${safeRate(value)} ${zh('分 / 100 回合', 'pts / 100 poss.', english)} · ${safeRate(row.possessions)} ${zh('回合', 'poss.', english)} · ${zh(row.quality === 'high' ? '高样本' : row.quality === 'medium' ? '中样本' : '低样本', `${row.quality} sample`, english)}`;
  });
  if (defensive) items.push(zh('防守口径为对手每 100 个对位回合得分，数值越低表示当前覆盖样本中的得分限制越强。', 'Defense is opponent points per 100 matchup possessions; lower means stronger scoring restriction in this covered sample.', english));
  return {
    title: zh(`排行榜 · ${defensive ? '防守限制' : '进攻效率'}`, `Rankings · ${defensive ? 'defensive restriction' : 'offensive efficiency'}`, english),
    body: (items.length ? items.join('\n') : zh('当前赛季和样本门槛下没有合格记录。', 'No qualified rows for the selected season and sample threshold.', english)) + freshness(data, english),
    action: { label: zh('查看完整排行榜', 'View full rankings', english), href: `/rankings?season=${encoded(season)}&type=${type}&metric=${metric}&order=${defensive ? 'asc' : 'desc'}&minPossessions=${minimum}` },
  };
}

function playTypes(data: Dataset, player: Player, query: string, english: boolean): ScoutResult {
  const { season, type } = period(query, data);
  const defensive = /防守|defen/i.test(query);
  const group = defensive ? 'defensive' : 'offensive';
  const rows = getPlayerPlayTypes(data, player.id, { season, type }).filter((row) => row.grouping === group)
    .sort((a, b) => b.possessions - a.possessions).slice(0, 5);
  const items = rows.map((row, index) => `${index + 1}. ${row.playType} — ${row.possessions.toFixed(1)} ${zh('回合', 'poss.', english)} · ${safeRate(row.pointsPerPossession, 2)} ${zh('分 / 回合', 'pts / poss.', english)} · ${row.percentile == null ? '—' : `${Math.round(row.percentile * 100)}%`}`);
  const sourceDate = data.manifest.playerPlaytypesSourceUpdatedAt?.slice(0, 10);
  if (sourceDate) items.push(zh(`打法快照源更新时间：${sourceDate}。`, `Play-type snapshot source updated: ${sourceDate}.`, english));
  return {
    title: zh(`${player.shortName} · ${defensive ? '防守' : '进攻'}打法`, `${player.shortName} · ${defensive ? 'defensive' : 'offensive'} play types`, english),
    body: (items.length ? items.join('\n') : zh(`当前没有 ${player.shortName} 在 ${season} 的该类打法记录。`, `No ${defensive ? 'defensive' : 'offensive'} play-type rows for ${player.shortName} in ${season}.`, english)) + freshness(data, english),
    action: { label: zh('打开打法分析', 'Open play-type analysis', english), href: `/playtypes/${encoded(player.id)}?season=${encoded(season)}&type=${type}` },
  };
}

function playerSummary(data: Dataset, player: Player, query: string, english: boolean): ScoutResult {
  const { season, type } = period(query, data);
  const stats = getPlayerStats(data, player.id, { season, type })[0];
  if (!stats) return {
    title: zh(`${player.shortName} · 数据概览`, `${player.shortName} · player overview`, english),
    body: zh(`找到球员，但当前数据集没有 ${season} ${type === 'playoffs' ? '季后赛' : '常规赛'} 的球员统计记录。`, `Player found, but no ${season} ${type === 'playoffs' ? 'playoff' : 'regular-season'} stats are available in this dataset.`, english) + freshness(data, english),
    action: { label: zh('打开球员页面', 'Open player profile', english), href: `/players/${encoded(player.id)}?season=${encoded(season)}` },
  };
  return {
    title: zh(`${player.shortName} · ${season} 球员数据`, `${player.shortName} · ${season} player stats`, english),
    body: [
      `${zh('球队 / 位置', 'Team / position', english)}：${player.teamAbbreviation} / ${player.position}`,
      `${zh('场均得分 / 篮板 / 助攻', 'PPG / RPG / APG', english)}：${safeRate(stats.pointsPerGame)} / ${safeRate(stats.reboundsPerGame)} / ${safeRate(stats.assistsPerGame)}`,
      `${zh('投篮 / 三分命中率', 'FG% / 3P%', english)}：${safeRate(stats.fieldGoalPercentage)}% / ${safeRate(stats.threePointPercentage)}% · ${stats.gamesPlayed} ${zh('场', 'games', english)}`,
    ].join('\n') + freshness(data, english),
    action: { label: zh('打开球员画像', 'Open player profile', english), href: `/players/${encoded(player.id)}?season=${encoded(season)}` },
  };
}

function teamSummary(data: Dataset, teams: Team[], query: string, english: boolean): ScoutResult {
  const { season, type } = period(query, data);
  const rows = teams.map((team) => ({ team, stats: getTeamStats(data, team.id, { season, type })[0] }));
  const playtypeRequested = /打法|play.?type|synergy/i.test(query);
  const fields = (stats: NonNullable<typeof rows[number]['stats']>) => {
    const values = [
      zh(`进攻效率 ${safeRate(stats.offensiveRating)}`, `Offensive rating ${safeRate(stats.offensiveRating)}`, english),
      zh(`防守效率 ${safeRate(stats.defensiveRating)}`, `Defensive rating ${safeRate(stats.defensiveRating)}`, english),
      zh(`节奏 ${safeRate(stats.pace)}`, `Pace ${safeRate(stats.pace)}`, english),
    ];
    if (stats.offensiveRating != null && stats.defensiveRating != null) {
      values.push(zh(`净效率 ${safeRate(stats.offensiveRating - stats.defensiveRating)}`, `Net rating ${safeRate(stats.offensiveRating - stats.defensiveRating)}`, english));
    }
    if (stats.gamesPlayed != null) values.push(zh(`${stats.gamesPlayed} 场`, `${stats.gamesPlayed} games`, english));
    return values.join(' · ');
  };
  const notes = rows.map(({ team, stats }) => {
    if (!stats) return `${team.chineseName} (${team.abbreviation}): ${zh('当前数据集没有该赛季球队统计记录。', 'No team stats for this season in the current dataset.', english)}`;
    const playTypes = playtypeRequested
      ? getTeamPlayTypes(data, team.id, { season, type }).filter((row) => row.grouping === (/防守|defen/i.test(query) ? 'defensive' : 'offensive')).sort((a, b) => b.possessions - a.possessions).slice(0, 3)
      : [];
    const playSummary = playtypeRequested && !playTypes.length
      ? zh('球队打法快照当前没有可用记录。', 'No team play-type snapshot is available.', english)
      : playTypes.map((row) => `${row.playType} (${safeRate(row.possessions)} ${zh('回合', 'poss.', english)}, ${safeRate(row.pointsPerPossession, 2)} ${zh('分/回合', 'pts/poss.', english)})`).join(' · ');
    return `${team.chineseName} (${team.abbreviation}): ${fields(stats)}${playtypeRequested ? `\n${zh('主要打法', 'Leading play types', english)}: ${playSummary}` : ''}`;
  });
  const isComparison = rows.length > 1;
  return {
    title: isComparison
      ? zh(`${rows[0].team.chineseName} × ${rows[1].team.chineseName} 球队对比`, `${rows[0].team.name} × ${rows[1].team.name} team comparison`, english)
      : zh(`${rows[0].team.chineseName} · 球队分析`, `${rows[0].team.name} · team analysis`, english),
    body: `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)}\n${notes.join('\n')}\n\n${zh('效率与节奏来自已发布球队快照；不代表实时排名或因果解释。', 'Ratings and pace come from the published team snapshot; they are not live rankings or causal estimates.', english)}${freshness(data, english)}`,
    action: isComparison
      ? { label: zh('打开球队对比', 'Open team comparison', english), href: `/team/compare?left=${encoded(rows[0].team.id)}&right=${encoded(rows[1].team.id)}&season=${encoded(season)}&type=${type}` }
      : { label: zh('打开球队分析', 'Open team analysis', english), href: `/team/pk?team=${encoded(rows[0].team.id)}&season=${encoded(season)}&type=${type}` },
  };
}

export function answerScoutQuestion(data: Dataset, query: string, english: boolean): ScoutResult {
  const teams = resolveTeams(data, query);
  const players = resolvePlayers(data, query);
  const isComparison = /对比|比较|vs\.?|versus|compare|head.?to.?head|交手/i.test(query);
  if (teams.length && (isComparison || /球队|team|pace|节奏|阵容|打法/i.test(query))) return teamSummary(data, teams.slice(0, 2), query, english);
  const isPlayerComparison = players.length > 1 && isComparison;
  if (isPlayerComparison) return comparison(data, players.slice(0, 2), query, english);
  if (players[0] && /打法|play.?type|isolation|transition|挡拆|单打|定点/i.test(query)) return playTypes(data, players[0], query, english);
  if (players[0] && /谁|对位|限制|最强|最弱|最差|最难|matchup|limit|restrict|opponent/i.test(query)) return matchupLeaders(data, players[0], query, english);
  if (/排行|榜|排名|top\s*\d|leaders?|rankings?|效率最高/i.test(query)) return rankings(data, query, english);
  if (players[0]) return playerSummary(data, players[0], query, english);
  const matches = searchPlayers(data, query).slice(0, 3);
  if (matches.length) return {
    title: zh('找到相关球员', 'Players found', english),
    body: matches.map((player) => `${player.shortName} · ${player.teamAbbreviation} · ${player.position}`).join('\n') + zh('\n\n请在问题中使用完整球员姓名，或直接点击下方搜索。', '\n\nUse a player name in your question, or open player search below.', english),
    action: { label: zh('查看球员目录', 'Open player directory', english), href: '/players' },
  };
  return {
    title: zh('我可以帮你查 NBA 对位数据', 'Ask about NBA matchup data', english),
    body: zh('目前支持：球员赛季数据、两名球员的直接对位、球员的强弱对位、防守限制榜，以及球员进攻/防守打法。数字来自当前 CourtMatch 数据集，不支持伤病、实时新闻、比赛预测或投注建议。', 'I can look up player season stats, head-to-head matchups, a player’s strongest/weakest matchups, defensive rankings, and play types. Numbers come from the current CourtMatch dataset; injuries, breaking news, game predictions and betting advice are not supported.', english),
  };
}
