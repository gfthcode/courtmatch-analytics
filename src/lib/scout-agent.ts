import type { DailyGameLog, Dataset, Player, PlayerStats, SeasonType } from './types';
import type { ScoutResult } from './scout';
import { DEMO_PLAYERS } from './data';
import { scoutSourceNote } from './scout-provenance';

const text = (zh: string, en: string, english: boolean) => english ? en : zh;
const rate = (value: number | null | undefined, decimals = 1) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(decimals);
const signed = (value: number) => `${value >= 0 ? '+' : ''}${rate(value)}`;
const finite = (value: number | null | undefined): value is number => value != null && Number.isFinite(value);
const currentSeason = (data: Dataset) => [...new Set([...data.seasons, ...data.playerStats.map((row) => row.season)])].sort().reverse()[0] ?? '';
const periodLabel = (seasonType: SeasonType, english: boolean) => seasonType === 'playoffs' ? text('季后赛', 'playoffs', english) : text('常规赛', 'regular season', english);
const nbaTeamNames: Record<string, [string, string]> = {
  ATL: ['亚特兰大老鹰', 'Atlanta Hawks'], BOS: ['波士顿凯尔特人', 'Boston Celtics'],
  BKN: ['布鲁克林篮网', 'Brooklyn Nets'], CHA: ['夏洛特黄蜂', 'Charlotte Hornets'],
  CHI: ['芝加哥公牛', 'Chicago Bulls'], CLE: ['克利夫兰骑士', 'Cleveland Cavaliers'],
  DAL: ['达拉斯独行侠', 'Dallas Mavericks'], DEN: ['丹佛掘金', 'Denver Nuggets'],
  DET: ['底特律活塞', 'Detroit Pistons'], GSW: ['金州勇士', 'Golden State Warriors'],
  HOU: ['休斯顿火箭', 'Houston Rockets'], IND: ['印第安纳步行者', 'Indiana Pacers'],
  LAC: ['洛杉矶快船', 'Los Angeles Clippers'], LAL: ['洛杉矶湖人', 'Los Angeles Lakers'],
  MEM: ['孟菲斯灰熊', 'Memphis Grizzlies'], MIA: ['迈阿密热火', 'Miami Heat'],
  MIL: ['密尔沃基雄鹿', 'Milwaukee Bucks'], MIN: ['明尼苏达森林狼', 'Minnesota Timberwolves'],
  NOP: ['新奥尔良鹈鹕', 'New Orleans Pelicans'], NYK: ['纽约尼克斯', 'New York Knicks'],
  OKC: ['俄克拉荷马城雷霆', 'Oklahoma City Thunder'], ORL: ['奥兰多魔术', 'Orlando Magic'],
  PHI: ['费城76人', 'Philadelphia 76ers'], PHX: ['菲尼克斯太阳', 'Phoenix Suns'],
  POR: ['波特兰开拓者', 'Portland Trail Blazers'], SAC: ['萨克拉门托国王', 'Sacramento Kings'],
  SAS: ['圣安东尼奥马刺', 'San Antonio Spurs'], TOR: ['多伦多猛龙', 'Toronto Raptors'],
  UTA: ['犹他爵士', 'Utah Jazz'], WAS: ['华盛顿奇才', 'Washington Wizards'],
};

export type WatchlistOptions = { query?: string; season?: string; seasonType?: SeasonType; recentGames?: number };

function requestedPeriod(data: Dataset, query = '', options?: WatchlistOptions) {
  const match = query.match(/(20\d{2})\s*[-–—/]\s*(20\d{2}|\d{2})/);
  const endYear = query.match(/(20\d{2})\s*(?:年\s*)?(?:季后赛|playoffs|postseason)/i)?.[1];
  const season = match ? `${match[1]}-${match[2].slice(-2)}` : endYear ? `${Number(endYear) - 1}-${endYear.slice(-2)}` : options?.season ?? currentSeason(data);
  const playoffs = /季后赛|\bplayoffs?\b|\bpostseason\b/i.test(query);
  const regular = /常规赛|\bregular(?:\s+season)?\b/i.test(query);
  const seasonType: SeasonType = playoffs ? 'playoffs' : regular ? 'regular' : options?.seasonType ?? 'regular';
  return { season, seasonType, mixed: playoffs && regular };
}

function latestRows(data: Dataset, season: string, seasonType: SeasonType): Map<string, PlayerStats> {
  const rows = new Map<string, PlayerStats>();
  for (const row of data.playerStats) {
    if (row.season !== season || row.seasonType !== seasonType) continue;
    const existing = rows.get(row.playerId);
    // Prefer the full-season row over a traded player's partial team stint.
    if (!existing || row.gamesPlayed > existing.gamesPlayed || (row.gamesPlayed === existing.gamesPlayed && row.updatedAt > existing.updatedAt)) rows.set(row.playerId, row);
  }
  return rows;
}

function unavailablePeriod(data: Dataset, season: string, seasonType: SeasonType, english: boolean): ScoutResult {
  const periods = [...new Set(data.playerStats.map((row) => `${row.season} ${periodLabel(row.seasonType, english)}`))].sort().reverse();
  return {
    title: text('该赛季数据暂不可用', 'Requested period unavailable', english),
    body: text(`当前没有 ${season} ${periodLabel(seasonType, false)} 的球员统计，不会改用其他赛季回答。\n可用范围：${periods.join('、') || '暂无球员统计'}。`, `No player statistics are published for ${season} ${periodLabel(seasonType, true)}. No other period has been substituted.\nAvailable: ${periods.join(', ') || 'no player statistics'}.`, english),
    action: { label: text('查看数据来源', 'View data sources', english), href: '/sources' },
  };
}

function mixedPeriod(english: boolean): ScoutResult {
  return { title: text('请分别查看常规赛和季后赛', 'Choose one season type', english), body: text('常规赛与季后赛的对手、轮换和样本不同。请指定其中一种，再生成同口径的分析。', 'Regular-season and playoff opponents, rotations and samples differ. Select one season type for a consistent comparison.', english) };
}

function recentLogs(data: Dataset, playerId: string, season: string, seasonType: SeasonType, count: number): DailyGameLog[] {
  const games = new Map<string, DailyGameLog>();
  for (const row of data.daily ?? []) {
    if (row.playerId !== playerId || row.season !== season || row.seasonType !== seasonType || !finite(row.minutes) || row.minutes <= 0) continue;
    const key = row.gameId || row.id;
    if (!games.has(key) || row.updatedAt > games.get(key)!.updatedAt) games.set(key, row);
  }
  return [...games.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
}

function average(games: DailyGameLog[], key: 'points' | 'rebounds' | 'assists'): number | null {
  return games.length && games.every((game) => finite(game[key])) ? games.reduce((sum, game) => sum + game[key], 0) / games.length : null;
}

function teamName(data: Dataset, player: Player, stats: PlayerStats | undefined, english: boolean): string {
  const abbreviation = stats?.teamAbbreviation || player.teamAbbreviation;
  const canonical = nbaTeamNames[abbreviation];
  if (canonical) return text(...canonical, english);
  if (abbreviation === 'TOT') return text('合并球队统计', 'Combined teams', english);
  const team = data.teams.find((entry) => entry.abbreviation === abbreviation);
  return team ? english ? team.name : team.chineseName || team.name : abbreviation;
}

export function buildWatchlistReport(data: Dataset, playerIds: string[], english: boolean, options?: WatchlistOptions): ScoutResult {
  const { season, seasonType, mixed } = requestedPeriod(data, options?.query, options);
  if (mixed) return mixedPeriod(english);
  const playersById = new Map(data.players.map((player) => [player.id, player]));
  const selected = [...new Set(playerIds)].map((id) => playersById.get(id)).filter((player): player is Player => Boolean(player));
  if (!selected.length) return {
    title: text('关注球员变化', 'Player watchlist', english),
    body: text('还没有可识别的关注球员。先搜索并添加球员，再生成变化简报。关注清单只保存在当前浏览器。', 'There are no recognized players in your watchlist. Search and add players, then generate a change brief. The list is stored in this browser only.', english),
    action: { label: text('打开球员目录', 'Open player directory', english), href: '/players' },
  };
  const current = latestRows(data, season, seasonType);
  if (!current.size) return unavailablePeriod(data, season, seasonType, english);
  const previousSeason = [...new Set(data.playerStats.filter((row) => row.seasonType === seasonType).map((row) => row.season))].filter((candidate) => candidate < season).sort().reverse()[0];
  const previous = previousSeason ? latestRows(data, previousSeason, seasonType) : new Map<string, PlayerStats>();
  const requestedGames = Number(options?.query?.match(/(?:最近|近|last)\s*(\d{1,2})\s*(?:场|games?)/i)?.[1] ?? options?.recentGames ?? 5);
  const count = Number.isFinite(requestedGames) ? Math.max(1, Math.min(20, Math.floor(requestedGames))) : 5;
  const signals = [
    { key: 'points', stat: 'pointsPerGame', zh: '分', en: 'PPG' },
    { key: 'rebounds', stat: 'reboundsPerGame', zh: '篮板', en: 'RPG' },
    { key: 'assists', stat: 'assistsPerGame', zh: '助攻', en: 'APG' },
  ] as const;
  const reports = selected.map((player) => {
    const now = current.get(player.id);
    const before = previous.get(player.id);
    const logs = recentLogs(data, player.id, season, seasonType, count);
    const lines = [`${player.shortName} · ${teamName(data, player, now, english)}`];
    if (now) lines.push(text(`本季场均 ${rate(now.pointsPerGame)} 分 / ${rate(now.reboundsPerGame)} 篮板 / ${rate(now.assistsPerGame)} 助攻（${now.gamesPlayed} 场）；统计更新 ${now.updatedAt?.slice(0, 10) || '未知'}。`, `Season: ${rate(now.pointsPerGame)} PPG / ${rate(now.reboundsPerGame)} RPG / ${rate(now.assistsPerGame)} APG (${now.gamesPlayed} games); statistics updated ${now.updatedAt?.slice(0, 10) || 'unknown'}.`, english));
    else lines.push(text(`缺少 ${season} ${periodLabel(seasonType, false)} 球员统计，不能计算与赛季均值的差异。`, `No ${season} ${periodLabel(seasonType, true)} player statistics; season-average comparisons are unavailable.`, english));
    if (logs.length) {
      const form = signals.map(({ key, stat, zh, en }) => {
        const value = average(logs, key);
        const baseline = now?.[stat];
        return `${rate(value)} ${text(zh, en, english)}${value != null && finite(baseline) ? text(`（较本季 ${signed(value - baseline)}）`, ` (${signed(value - baseline)} vs season)`, english) : text('（差异不可用）', ' (comparison unavailable)', english)}`;
      }).join(' / ');
      lines.push(text(`已收录最近 ${logs.length} 场：${form}。\n比赛日期 ${logs.at(-1)!.date} 至 ${logs[0].date}；该区间为已收录比赛，可能不是当前最新比赛。`, `Last ${logs.length} published games: ${form}.\nGame dates ${logs.at(-1)!.date} to ${logs[0].date}; these may not be the latest games played.`, english));
      if (logs.length < count) lines.push(text(`请求近 ${count} 场，但仅有 ${logs.length} 场有效记录。`, `${count} games requested; only ${logs.length} valid records are available.`, english));
    } else lines.push(text('当前发布目录没有该球员在所选赛季类型下的有效比赛日志，暂时无法计算近况差异。', 'No valid game logs are published for this player and season type; recent-form changes are unavailable.', english));
    if (now && before) {
      const changes = signals.map(({ stat, zh, en }) => finite(now[stat]) && finite(before[stat]) ? `${signed(now[stat] - before[stat])} ${text(zh, en, english)}` : `${text(zh, en, english)} —`).join(' / ');
      lines.push(text(`相较 ${previousSeason} ${periodLabel(seasonType, false)}：${changes}。`, `Versus ${previousSeason} ${periodLabel(seasonType, true)}: ${changes}.`, english));
    } else lines.push(text('缺少可比的上一赛季数据，未生成同比变化。', 'Comparable prior-season statistics are missing; no year-over-year change is calculated.', english));
    return lines.join('\n');
  });
  const missingIds = new Set(playerIds).size - selected.length;
  const note = data.manifest.status === 'stale'
    ? text('数据目录当前标记为待更新/过期；此简报不是实时推送。', 'The published dataset is marked stale; this is not a live alert.', english)
    : text('这是当前已发布快照，不是后台监控或实时通知。', 'This uses the current published snapshot; it is not background monitoring or a live alert.', english);
  return {
    title: text('关注球员 · 变化简报', 'Watchlist · change brief', english),
    body: `${reports.join('\n\n')}\n\n${text(`本地关注 ${selected.length} 人 · ${season} ${periodLabel(seasonType, false)} · ${note}`, `Tracking ${selected.length} locally saved player(s) · ${season} ${periodLabel(seasonType, true)} · ${note}`, english)}${missingIds ? `\n${text(`${missingIds} 个已保存球员未在当前目录找到。`, `${missingIds} saved player(s) are absent from the current directory.`, english)}` : ''}\n${scoutSourceNote(data, 'player', season, english)}`,
    action: { label: text('查看球员数据', 'View player data', english), href: `/players?season=${encodeURIComponent(season)}&type=${seasonType}` },
  };
}

export type FitMetric = 'shooting' | 'playmaking' | 'scoring' | 'rebounding' | 'defense';
export type FitWeights = Record<FitMetric, number>;
type Candidate = { player: Player; stats: PlayerStats; values: Record<FitMetric, number | null> };
const metricLabels: Record<FitMetric, [string, string]> = {
  shooting: ['三分命中率', '3P%'], playmaking: ['场均助攻', 'APG'], scoring: ['场均得分', 'PPG'],
  rebounding: ['场均篮板', 'RPG'], defense: ['场均抢断+盖帽', 'STL+BLK per game'],
};
const allMetrics = Object.keys(metricLabels) as FitMetric[];
const rolePatterns = {
  guard: /后卫|控卫|分卫|\bguards?\b|\bbackcourt\b|\bpg\b|\bsg\b/i,
  wing: /锋线|前锋|\bwings?\b|\bforwards?\b|\bsf\b|\bpf\b/i,
  big: /内线|中锋|\bcenters?\b|\bcentres?\b|\bbigs?\b/i,
};
const roles = [
  { key: 'guard', zh: '后卫', en: 'Guards', accepts: (position: string) => position.includes('G') },
  { key: 'wing', zh: '锋线', en: 'Wings', accepts: (position: string) => position.includes('F') },
  { key: 'big', zh: '内线', en: 'Bigs', accepts: (position: string) => position.includes('C') },
] as const;
const exclusion = /排除|不要|不含|不选|不考虑|除了|\bexclude\b|\bexcluding\b|\bexcept\b|\bwithout\b|\bnot\b|\bno\b/i;
const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mention(query: string, names: string[]) {
  return names.filter((name) => name.trim().length >= 2).sort((a, b) => b.length - a.length).flatMap((name) => {
    const normalized = fold(name);
    const pattern = normalized.split(/[\s·.'’-]+/).filter(Boolean).map(escapeRegex).join('[\\s·.\'’\\-]*');
    const match = fold(query).match(new RegExp(`${/^[a-z0-9]/.test(normalized) ? '(?<![a-z0-9])' : ''}${pattern}${/[a-z0-9]$/.test(normalized) ? '(?![a-z0-9])' : ''}`, 'i'));
    return match ? [{ index: match.index!, name: match[0] }] : [];
  }).sort((a, b) => a.index - b.index || b.name.length - a.name.length)[0];
}

function precedingClause(query: string, index: number) {
  return query.slice(0, index).split(/[，,；;。.!?！？\n]/).at(-1) ?? '';
}

function isExcluded(query: string, index: number) {
  const prefix = precedingClause(query, index).split(/但是|但|只要|只选|\bbut\b|\bonly\b/i).at(-1) ?? '';
  return exclusion.test(prefix);
}

function requestedEntities(data: Dataset, query: string) {
  const players = data.players.flatMap((player) => {
    const known = DEMO_PLAYERS.find((candidate) => fold(candidate.name) === fold(player.name));
    const match = mention(query, [player.name, player.shortName, player.chineseName, ...player.aliases, ...(known?.aliases ?? [])]);
    return match ? [{ player, excluded: isExcluded(query, match.index) }] : [];
  });
  const teams = data.teams.flatMap((team) => {
    const known = nbaTeamNames[team.abbreviation];
    const chinese = known?.[0] || team.chineseName;
    const names = [team.name, team.chineseName, chinese, team.abbreviation, ...(known ? [known[1]] : []), (known?.[1] || team.name).split(' ').at(-1) ?? ''];
    const nickname = chinese.match(/(老鹰|凯尔特人|篮网|黄蜂|公牛|骑士|独行侠|掘金|活塞|勇士|火箭|步行者|快船|湖人|灰熊|热火|雄鹿|森林狼|鹈鹕|尼克斯|雷霆|魔术|76人|太阳|开拓者|国王|马刺|猛龙|爵士|奇才)$/)?.[1];
    if (nickname) names.push(nickname);
    const match = mention(query, names);
    if (!match) return [];
    const prefix = precedingClause(query, match.index);
    return [{ team, excluded: isExcluded(query, match.index), only: /只(?:要|看|选)|仅|来自|\bonly\b|\bfrom\b/i.test(prefix) }];
  });
  return { players, teams };
}

function percentile(value: number, pool: number[]): number {
  if (pool.length < 2) return 0.5;
  const lower = pool.filter((candidate) => candidate < value).length;
  const tied = pool.filter((candidate) => candidate === value).length;
  return (lower + Math.max(0, tied - 1) / 2) / (pool.length - 1);
}

const metricDisplay = (metric: FitMetric, value: number | null, english: boolean) => `${text(...metricLabels[metric], english)} ${metric === 'shooting' && value != null ? `${rate(value * 100)}%` : rate(value)}`;

export function buildLineupFitReport(data: Dataset, query: string, english: boolean, selectedWeights?: FitWeights): ScoutResult {
  const { season, seasonType, mixed } = requestedPeriod(data, query);
  if (mixed) return mixedPeriod(english);
  const allStats = latestRows(data, season, seasonType);
  if (!allStats.size) return unavailablePeriod(data, season, seasonType, english);
  const metricPatterns: Record<FitMetric, RegExp> = {
    shooting: /空间|投射|三分|投篮|\bshoot\w*\b|\bspacing\b|\bthree\b|\b3p\w*\b|\b3(?:-and-)?d\b/i,
    playmaking: /组织|助攻|传球|\bplaymak\w*\b|\bassist\w*\b/i,
    scoring: /得分|进攻(?!篮板)|\bscor\w*\b|\boffens\w*\b(?!\s+rebounds?)/i,
    rebounding: /篮板|\brebound\w*\b/i,
    defense: /防守(?!篮板)|护框|盖帽|抢断|\bdefen\w*\b(?!\s+rebounds?)|\bblock\w*\b|\bsteal\w*\b|\b3(?:-and-)?d\b/i,
  };
  const signalMentions = allMetrics.map((metric) => ({ metric, match: query.match(metricPatterns[metric]) }));
  const requested = signalMentions.filter(({ match }) => match && !isExcluded(query, match.index!)).map(({ metric }) => metric);
  const excludedSignals = new Set(signalMentions.filter(({ match }) => match && isExcluded(query, match.index!)).map(({ metric }) => metric));
  const defaults: FitMetric[] = ['shooting', 'playmaking', 'rebounding', 'defense'];
  const baseMetrics = (requested.length ? requested : defaults).filter((metric) => !excludedSignals.has(metric));
  if (!baseMetrics.length) return {
    title: text('请选择至少一个筛选指标', 'Select at least one signal', english),
    body: text('你排除了所有默认筛选指标。请指定得分、篮板、组织、投射或防守中的至少一项。', 'All default signals have been excluded. Request at least one of scoring, rebounding, playmaking, shooting or defense.', english),
  };
  const weights = Object.fromEntries(allMetrics.map((metric) => [metric, selectedWeights ? finite(selectedWeights[metric]) ? Math.max(0, Math.min(3, selectedWeights[metric])) : 0 : 1])) as FitWeights;
  const metrics = baseMetrics.filter((metric) => weights[metric] > 0);
  if (!metrics.length) return {
    title: text('阵容搭配探索 · 请设置权重', 'Lineup fit · set a weight', english),
    body: text(`当前筛选指标（${baseMetrics.map((metric) => metricLabels[metric][0]).join('、')}）的权重都为 0。请把至少一项调到大于 0，再生成候选名单。其他未在问题中提及的指标不参与本次排序。`, `All selected signals (${baseMetrics.map((metric) => metricLabels[metric][1]).join(', ')}) have zero weight. Increase at least one above zero. Signals not requested in the question do not affect this ranking.`, english),
  };
  const roleMentions = roles.map((role) => ({ role, match: query.match(rolePatterns[role.key]) }));
  const positiveRoles = new Set(roleMentions.filter(({ match }) => match && !isExcluded(query, match.index!)).map(({ role }) => role.key));
  const negativeRoles = new Set(roleMentions.filter(({ match }) => match && isExcluded(query, match.index!)).map(({ role }) => role.key));
  const selectedRoles = roles.filter((role) => (!positiveRoles.size || positiveRoles.has(role.key)) && !negativeRoles.has(role.key));
  const entities = requestedEntities(data, query);
  const anchors = entities.players.filter((entry) => !entry.excluded).map((entry) => entry.player);
  if (/围绕|搭档|\baround\b|\bpartner\s+for\b/i.test(query) && !anchors.length && !entities.teams.length) return {
    title: text('先确定搭配对象', 'Identify the player to build around', english),
    body: text('没有识别出要围绕搭配的球员。请写完整球员名，例如“围绕 Stephen Curry 找有防守和篮板的内线”。', 'The player to build around was not recognized. Use a full player name, for example “Find a defensive, rebounding center around Stephen Curry”.', english),
  };
  const excludedPlayers = new Set(entities.players.map((entry) => entry.player.id));
  const excludedTeams = new Set(entities.teams.filter((entry) => entry.excluded).map((entry) => entry.team.abbreviation));
  const onlyTeams = new Set(entities.teams.filter((entry) => !entry.excluded && entry.only).map((entry) => entry.team.abbreviation));
  const requestedGames = Number(query.match(/(?:至少|不低于|>=|minimum|at\s+least)\s*(\d{1,3})\s*(?:场|games?)/i)?.[1] ?? 0);
  const requestedMinutes = Number(query.match(/(?:至少|不低于|>=|minimum|at\s+least)\s*(\d{1,2}(?:\.\d+)?)\s*(?:分钟|minutes?|mpg)/i)?.[1] ?? 0);
  const minimumGames = Math.max(seasonType === 'playoffs' ? 3 : 10, requestedGames);
  const minimumMinutes = Math.max(12, requestedMinutes);
  const playersById = new Map(data.players.map((player) => [player.id, player]));
  const qualification = text(`至少 ${minimumGames} 场、场均至少 ${minimumMinutes} 分钟`, `at least ${minimumGames} games and ${minimumMinutes} minutes per game`, english);
  const valuesFor = (stats: PlayerStats): Record<FitMetric, number | null> => ({
    shooting: finite(stats.threePointersAttemptedPerGame) && stats.threePointersAttemptedPerGame >= 1.5
      && stats.threePointersAttemptedPerGame * stats.gamesPlayed >= 50
      && finite(stats.threePointPercentage) && stats.threePointPercentage >= 0 && stats.threePointPercentage <= 1 ? stats.threePointPercentage : null,
    playmaking: finite(stats.assistsPerGame) ? stats.assistsPerGame : null,
    scoring: finite(stats.pointsPerGame) ? stats.pointsPerGame : null,
    rebounding: finite(stats.reboundsPerGame) ? stats.reboundsPerGame : null,
    defense: finite(stats.stealsPerGame) && finite(stats.blocksPerGame) ? stats.stealsPerGame + stats.blocksPerGame : null,
  });
  const qualified: Candidate[] = [...allStats.entries()].flatMap(([id, stats]) => {
    const player = playersById.get(id);
    if (!player || !finite(stats.gamesPlayed) || stats.gamesPlayed < minimumGames || !finite(stats.minutesPerGame) || stats.minutesPerGame < minimumMinutes) return [];
    return [{ player, stats, values: valuesFor(stats) }];
  });
  if (!qualified.length) return {
    title: text('阵容搭配探索 · 样本不足', 'Lineup fit · insufficient sample', english),
    body: text(`${season} ${periodLabel(seasonType, false)} 中，没有满足${qualification}且分钟数据完整的球员。未降低门槛生成推荐。`, `No ${season} ${periodLabel(seasonType, true)} players meet ${qualification} with verified minutes. Eligibility was not relaxed to generate recommendations.`, english),
    action: { label: text('查看球员数据', 'View player data', english), href: `/players?season=${encodeURIComponent(season)}&type=${seasonType}` },
  };
  const sections = selectedRoles.map((role) => {
    const peerRows = qualified.filter((candidate) => role.accepts(candidate.player.position));
    const pools = Object.fromEntries(allMetrics.map((metric) => [metric, peerRows.map((row) => row.values[metric]).filter(finite)])) as Record<FitMetric, number[]>;
    const scored = peerRows.filter((candidate) => {
      const team = candidate.stats.teamAbbreviation || candidate.player.teamAbbreviation;
      return !excludedPlayers.has(candidate.player.id) && !excludedTeams.has(team) && (!onlyTeams.size || onlyTeams.has(team))
        && metrics.every((metric) => candidate.values[metric] != null);
    }).map((candidate) => ({
      ...candidate,
      score: metrics.reduce((sum, metric) => sum + percentile(candidate.values[metric]!, pools[metric]) * weights[metric], 0) / metrics.reduce((sum, metric) => sum + weights[metric], 0),
    })).sort((a, b) => b.score - a.score || b.stats.gamesPlayed - a.stats.gamesPlayed || a.player.id.localeCompare(b.player.id));
    const entries = scored.slice(0, selectedRoles.length === 1 ? 5 : 2).map((candidate, index) => {
      const details = metrics.map((metric) => metricDisplay(metric, candidate.values[metric], english)).join(' · ');
      const relative = allMetrics.filter((metric) => candidate.values[metric] != null && pools[metric].length >= 3)
        .map((metric) => ({ metric, percentile: percentile(candidate.values[metric]!, pools[metric]) })).sort((a, b) => b.percentile - a.percentile);
      const strong = relative[0];
      const weak = relative.at(-1);
      const notes: string[] = [];
      if (strong && strong.percentile >= 0.65) notes.push(text(`相对强项：${metricDisplay(strong.metric, candidate.values[strong.metric], false)}（同组百分位 ${Math.round(strong.percentile * 100)}）`, `Relative strength: ${metricDisplay(strong.metric, candidate.values[strong.metric], true)} (peer percentile ${Math.round(strong.percentile * 100)})`, english));
      if (weak && weak.metric !== strong?.metric && weak.percentile <= 0.35) notes.push(text(`需权衡：${metricDisplay(weak.metric, candidate.values[weak.metric], false)}，低于同组多数球员`, `Trade-off: ${metricDisplay(weak.metric, candidate.values[weak.metric], true)}, below most eligible peers`, english));
      if (candidate.values.shooting == null) notes.push(text('三分出手样本不足或命中率缺失，不能据此判断空间能力', 'Three-point volume is insufficient or accuracy is missing; spacing cannot be assessed', english));
      if (!notes.length) notes.push(text('同位置基础数据较均衡；仍需结合打法与阵容验证', 'The available signals are relatively balanced; role and lineup context still need checking', english));
      return `${index + 1}. ${candidate.player.shortName} (${teamName(data, candidate.player, candidate.stats, english)} / ${text(role.zh, role.en, english)}) — ${Math.round(candidate.score * 100)} ${text('筛选分', 'fit score', english)}\n${details} · ${candidate.stats.gamesPlayed} ${text('场', 'GP', english)} · ${rate(candidate.stats.minutesPerGame)} ${text('分钟/场', 'MPG', english)}\n${notes.join('；')}`;
    });
    return `${text(role.zh, role.en, english)} · ${scored.length} ${text('名合格候选', 'eligible candidates', english)}\n${entries.length ? entries.join('\n\n') : text('当前筛选没有合格球员。可调整位置、球队或指标；未用缺失值冒充 0 分。', 'No candidates meet these filters. Adjust role, team or signals; missing values have not been presented as zero.', english)}`;
  });
  const criteria = metrics.map((metric) => `${text(...metricLabels[metric], english)} ×${rate(weights[metric])}`).join(' · ');
  const scope: string[] = [];
  if (anchors.length) {
    scope.push(text(`搭配对象：${anchors.map((player) => player.shortName).join('、')}；已从候选中排除。候选按你指定的技能筛选，不代表已验证的共同出场效果。`, `Build around: ${anchors.map((player) => player.shortName).join(', ')}; excluded from candidates. Players are ranked on your requested skills, not validated shared-court performance.`, english));
    for (const player of anchors) {
      const stats = allStats.get(player.id);
      scope.push(stats ? text(`${player.shortName} 本期基线：${rate(stats.pointsPerGame)} 分 / ${rate(stats.reboundsPerGame)} 篮板 / ${rate(stats.assistsPerGame)} 助攻。`, `${player.shortName} baseline: ${rate(stats.pointsPerGame)} PPG / ${rate(stats.reboundsPerGame)} RPG / ${rate(stats.assistsPerGame)} APG.`, english) : text(`${player.shortName} 缺少所选期间统计，不能估算互补程度。`, `${player.shortName} has no statistics for this period; complementarity cannot be estimated.`, english));
    }
  }
  if (entities.players.some((entry) => entry.excluded)) scope.push(text(`排除球员：${entities.players.filter((entry) => entry.excluded).map((entry) => entry.player.shortName).join('、')}。`, `Excluded players: ${entities.players.filter((entry) => entry.excluded).map((entry) => entry.player.shortName).join(', ')}.`, english));
  if (onlyTeams.size) scope.push(text(`候选球队：${[...onlyTeams].join('、')}。`, `Candidate teams: ${[...onlyTeams].join(', ')}.`, english));
  if (excludedTeams.size) scope.push(text(`排除球队：${[...excludedTeams].join('、')}。`, `Excluded teams: ${[...excludedTeams].join(', ')}.`, english));
  if (excludedSignals.size) scope.push(text(`按要求不比较：${[...excludedSignals].map((metric) => metricLabels[metric][0]).join('、')}。`, `Signals excluded by request: ${[...excludedSignals].map((metric) => metricLabels[metric][1]).join(', ')}.`, english));
  const disabled = baseMetrics.filter((metric) => weights[metric] === 0);
  if (disabled.length) scope.push(text(`权重为 0，未计入排序：${disabled.map((metric) => metricLabels[metric][0]).join('、')}。`, `Zero-weight signals omitted: ${disabled.map((metric) => metricLabels[metric][1]).join(', ')}.`, english));
  return {
    title: text('阵容搭配探索 · 候选球员', 'Lineup fit · player candidates', english),
    body: `${text(`赛季：${season} ${periodLabel(seasonType, false)} · ${qualification}\n筛选：${criteria}`, `Season: ${season} ${periodLabel(seasonType, true)} · ${qualification}\nSignals: ${criteria}`, english)}${scope.length ? `\n${scope.join('\n')}` : ''}\n\n${sections.join('\n\n') || text('位置条件互相冲突，没有可筛选的位置组。', 'The role constraints conflict; no role group remains.', english)}\n\n${text('算法：每个位置组内，对合格球员的单项数据计算百分位，再按所示权重加权平均。不同位置的分数不可直接比较；缺失的必选指标不参与候选排序，缺少分钟数据也不入榜。投射指标须场均至少 1.5 次三分出手且赛季至少 50 次（按场均×场次估算）。抢断+盖帽只是防守数据代理指标，不等于防守效率。匹配分不代表球员间化学反应、真实阵容胜率或因果结论；未评估合同、交易可行性或伤病。', 'Method: each signal is percentile-ranked within the eligible position group, then combined using the displayed weights. Scores cannot be compared across roles. Candidates missing required signals or minutes are excluded. Shooting requires at least 1.5 threes attempted per game and 50 attempts in the season (estimated as per-game attempts × games). Steals plus blocks are a proxy, not defensive efficiency. Fit is not chemistry, lineup win probability or causality; contracts, trade feasibility and injuries are not evaluated.', english)}\n${scoutSourceNote(data, 'player', season, english)}`,
    action: { label: text('打开球员目录', 'Open player directory', english), href: `/players?season=${encodeURIComponent(season)}&type=${seasonType}` },
  };
}
