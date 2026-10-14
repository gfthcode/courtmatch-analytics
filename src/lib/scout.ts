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
import type { Dataset, Player, PlayerStats, PlayType, SeasonType, Team } from './types';
import { DEMO_DATA } from './data';
import { sampleLabel, scoutSourceNote } from './scout-provenance';

export type ScoutAction = { label: string; href: string };
export type ScoutSource = { label: string; href: string };
export type ScoutResult = { title: string; body: string; action?: ScoutAction; sources?: ScoutSource[] };
export type ScoutNewsArticle = { id: string; title: string; titleZh?: string; summary?: string; summaryZh?: string; url: string; publishedAt: string; author?: string; categories?: string[] };
export type ScoutNewsFeed = { source?: string; updatedAt?: string; articles: ScoutNewsArticle[] };

const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\s·.'’-]/g, '');
const zh = (text: string, en: string, english: boolean) => english ? en : text;
const encoded = (value: string) => encodeURIComponent(value);

const commonPlayerAliases: Record<string, string[]> = {
  'Stephen Curry': ['库里', '萌神'], 'LeBron James': ['詹姆斯', '勒布朗', '老詹'],
  'Kevin Durant': ['杜兰特', '阿杜', 'KD'], 'Luka Doncic': ['东契奇', '卢卡'],
  'Nikola Jokic': ['约基奇', '约老师'], 'Giannis Antetokounmpo': ['字母哥', '扬尼斯'],
  'Shai Gilgeous-Alexander': ['亚历山大', '谢伊', 'SGA'], 'Jayson Tatum': ['塔图姆'],
  'Anthony Davis': ['戴维斯', '浓眉'], 'Anthony Edwards': ['爱德华兹', '华子'],
  'Victor Wembanyama': ['文班亚马', '文班'], 'Joel Embiid': ['恩比德'],
  'James Harden': ['哈登'], 'Kawhi Leonard': ['伦纳德', '莱昂纳德', '小卡'],
  'Damian Lillard': ['利拉德'], 'Devin Booker': ['布克'], 'Donovan Mitchell': ['米切尔'],
  'Kyrie Irving': ['欧文'], 'Jimmy Butler': ['巴特勒'], 'Jaylen Brown': ['杰伦布朗', '杰伦·布朗'],
  'Jalen Brunson': ['布伦森'], 'Bam Adebayo': ['阿德巴约'], 'Tyrese Haliburton': ['哈利伯顿'],
  'Tyrese Maxey': ['马克西'], 'Chet Holmgren': ['霍姆格伦', '切特'],
};
const extraAliases = new Map(Object.entries(commonPlayerAliases).map(([name, aliases]) => [normalize(name), aliases]));

function playerNames(player: Player): string[] {
  const aliases = DEMO_DATA.players.find((candidate) => normalize(candidate.name) === normalize(player.name));
  return [player.name, player.shortName, player.chineseName, ...player.aliases, aliases?.chineseName, ...(aliases?.aliases ?? []), ...(extraAliases.get(normalize(player.name)) ?? [])].filter((name): name is string => Boolean(name));
}

const teamAliases: Record<string, string[]> = {
  ATL: ['Atlanta Hawks', 'Hawks', '亚特兰大老鹰', '老鹰'],
  BOS: ['Boston Celtics', 'Celtics', '波士顿凯尔特人', '凯尔特人'],
  BKN: ['Brooklyn Nets', 'Nets', '布鲁克林篮网', '篮网'],
  CHA: ['Charlotte Hornets', 'Hornets', '夏洛特黄蜂', '黄蜂'],
  CHI: ['Chicago Bulls', 'Bulls', '芝加哥公牛', '公牛'],
  CLE: ['Cleveland Cavaliers', 'Cavaliers', 'Cavs', '克利夫兰骑士', '骑士'],
  DAL: ['Dallas Mavericks', 'Mavericks', 'Mavs', '达拉斯独行侠', '独行侠', '小牛'],
  DEN: ['Denver Nuggets', 'Nuggets', '丹佛掘金', '掘金'],
  DET: ['Detroit Pistons', 'Pistons', '底特律活塞', '活塞'],
  GSW: ['Golden State Warriors', 'Warriors', '金州勇士', '勇士'],
  HOU: ['Houston Rockets', 'Rockets', '休斯顿火箭', '火箭'],
  IND: ['Indiana Pacers', 'Pacers', '印第安纳步行者', '步行者'],
  LAC: ['Los Angeles Clippers', 'LA Clippers', 'Clippers', '洛杉矶快船', '快船'],
  LAL: ['Los Angeles Lakers', 'LA Lakers', 'Lakers', '洛杉矶湖人', '湖人'],
  MEM: ['Memphis Grizzlies', 'Grizzlies', '孟菲斯灰熊', '灰熊'],
  MIA: ['Miami Heat', '迈阿密热火', '热火'],
  MIL: ['Milwaukee Bucks', 'Bucks', '密尔沃基雄鹿', '雄鹿'],
  MIN: ['Minnesota Timberwolves', 'Timberwolves', 'Wolves', '明尼苏达森林狼', '森林狼'],
  NOP: ['New Orleans Pelicans', 'Pelicans', '新奥尔良鹈鹕', '鹈鹕'],
  NYK: ['New York Knicks', 'Knicks', '纽约尼克斯', '尼克斯'],
  OKC: ['Oklahoma City Thunder', 'Thunder', '俄克拉荷马城雷霆', '雷霆'],
  ORL: ['Orlando Magic', 'Magic', '奥兰多魔术', '魔术'],
  PHI: ['Philadelphia 76ers', '76ers', 'Sixers', '费城76人', '76人'],
  PHX: ['Phoenix Suns', 'Suns', '菲尼克斯太阳', '太阳'],
  POR: ['Portland Trail Blazers', 'Trail Blazers', 'Blazers', '波特兰开拓者', '开拓者'],
  SAC: ['Sacramento Kings', 'Kings', '萨克拉门托国王', '国王'],
  SAS: ['San Antonio Spurs', 'Spurs', '圣安东尼奥马刺', '马刺'],
  TOR: ['Toronto Raptors', 'Raptors', '多伦多猛龙', '猛龙'],
  UTA: ['Utah Jazz', 'Jazz', '犹他爵士', '爵士'],
  WAS: ['Washington Wizards', 'Wizards', '华盛顿奇才', '奇才'],
};

function nameSpan(query: string, name: string): { index: number; end: number } | undefined {
  const queryText = query.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const nameText = name.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const escaped = nameText.split(/[\s·.'’-]+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s·.\u0027\u2019-]*');
  const chinese = /[\u4e00-\u9fff]/.test(nameText);
  const match = new RegExp(chinese ? `()(${escaped})` : `(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, 'i').exec(queryText);
  return match ? { index: match.index + match[1].length, end: match.index + match[1].length + match[2].length } : undefined;
}
const nameIndex = (query: string, name: string) => nameSpan(query, name)?.index ?? -1;

export function resolveScoutPlayers(data: Dataset, query: string): Player[] {
  const hits = data.players.flatMap((player) => playerNames(player).filter((name) => name.length > 1).flatMap((name) => {
    const span = nameSpan(query, name);
    return span ? [{ player, ...span }] : [];
  })).sort((a, b) => (b.end - b.index) - (a.end - a.index));
  const accepted: typeof hits = [];
  for (const hit of hits) {
    if (accepted.some((other) => other.player.id !== hit.player.id && other.index < hit.end && hit.index < other.end && other.end - other.index > hit.end - hit.index)) continue;
    accepted.push(hit);
  }
  const found = new Map<string, typeof hits[number]>();
  for (const hit of accepted.sort((a, b) => a.index - b.index)) if (!found.has(hit.player.id)) found.set(hit.player.id, hit);
  return [...found.values()].map(({ player }) => player);
}

export function resolveScoutTeams(data: Dataset, query: string): Team[] {
  return data.teams.flatMap((team) => {
    const names = [team.name, team.chineseName, team.abbreviation, ...(teamAliases[team.abbreviation] ?? [])];
    const hits = names.filter((name) => name.length > 1).map((name) => nameIndex(query, name)).filter((index) => index >= 0);
    return hits.length ? [{ team, index: Math.min(...hits) }] : [];
  }).sort((a, b) => a.index - b.index).map(({ team }) => team);
}

export function scoutSeasons(data: Dataset): string[] {
  return [...new Set([...data.seasons, ...data.playerStats.map((row) => row.season), ...(data.daily ?? []).map((row) => row.season), ...data.teamStats.map((row) => row.season), ...data.playtypes.map((row) => row.season)])].sort().reverse();
}

function period(query: string, data: Dataset) {
  const requestedSeason = query.match(/20\d{2}-\d{2}/)?.[0];
  const season = requestedSeason ?? scoutSeasons(data)[0] ?? '';
  const type: SeasonType = /季后赛|playoffs?|postseason/i.test(query) ? 'playoffs' : 'regular';
  const minimum = Number(query.match(/(?:至少|不低于|minimum|min)\s*(\d{1,4})\s*(?:回合|possessions?)?/i)?.[1] ?? 25);
  return { season, type, minimum: Math.max(0, Math.min(1000, minimum)) };
}

const safeRate = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const safePercent = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`;

export function scoutResultCount(query: string): number {
  const token = query.match(/(?:前|top)\s*(\d{1,3}|[一二两三四五六七八九十]+)\s*(?:名|位|人)?/i)?.[1];
  const digits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const count = !token ? 5 : /^\d+$/.test(token) ? Number(token) : token.includes('十') ? (digits[token.split('十')[0]] ?? 1) * 10 + (digits[token.split('十')[1]] ?? 0) : digits[token] ?? 5;
  return Math.max(1, Math.min(20, count));
}

const playTypeNames: Record<PlayType, string> = { Isolation: '单打', Transition: '转换进攻', PRBallHandler: '挡拆持球', PRRollman: '挡拆顺下', Postup: '低位背打', Spotup: '定点投射', Handoff: '手递手', Cut: '空切', OffScreen: '绕掩护', OffRebound: '二次进攻', Misc: '其他' };
const playTypeName = (value: PlayType, english: boolean) => english ? value : playTypeNames[value];
const statsFor = (data: Dataset, playerId: string, season: string, type: SeasonType) => getPlayerStats(data, playerId, { season, type }).sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
const teamName = (data: Dataset, player: Player, english: boolean) => {
  if (english) return player.teamAbbreviation;
  const team = data.teams.find((item) => item.id === player.teamId || item.abbreviation === player.teamAbbreviation);
  return teamAliases[player.teamAbbreviation]?.find((name) => /[\u4e00-\u9fff]/.test(name)) ?? team?.chineseName ?? player.teamName ?? player.teamAbbreviation;
};

function playerComparison(data: Dataset, players: Player[], query: string, english: boolean): ScoutResult {
  const { season, type } = period(query, data);
  const defensive = /防守|defen|抢断|盖帽|steal|block/i.test(query);
  const lines = players.map((player) => {
    const stats = statsFor(data, player.id, season, type);
    if (!stats) return `${player.shortName}：${zh('该赛季 / 阶段暂无球员统计，未替用其他赛季。', 'No player stats for this season / phase; another season was not substituted.', english)}`;
    const values = defensive
      ? zh(`场均抢断 ${safeRate(stats.stealsPerGame)} · 盖帽 ${safeRate(stats.blocksPerGame)} · 防守篮板 ${safeRate(stats.defensiveReboundsPerGame)}`, `${safeRate(stats.stealsPerGame)} SPG · ${safeRate(stats.blocksPerGame)} BPG · ${safeRate(stats.defensiveReboundsPerGame)} defensive RPG`, english)
      : zh(`场均 ${safeRate(stats.pointsPerGame)} 分 / ${safeRate(stats.reboundsPerGame)} 篮板 / ${safeRate(stats.assistsPerGame)} 助攻\n投篮 ${safePercent(stats.fieldGoalPercentage)} · 三分 ${safePercent(stats.threePointPercentage)} · 真实命中率 ${safePercent(stats.trueShootingPercentage)}`, `${safeRate(stats.pointsPerGame)} PPG / ${safeRate(stats.reboundsPerGame)} RPG / ${safeRate(stats.assistsPerGame)} APG\nFG ${safePercent(stats.fieldGoalPercentage)} · 3P ${safePercent(stats.threePointPercentage)} · TS ${safePercent(stats.trueShootingPercentage)}`, english);
    return `${player.shortName} · ${stats.gamesPlayed} ${zh('场', 'games', english)}\n${values}`;
  });
  const caveat = defensive
    ? zh('抢断、盖帽与防守篮板只覆盖部分防守贡献；无法据此判断领防、换防与协防质量。', 'Steals, blocks and defensive rebounds cover only part of defense; they do not establish on-ball, switching or help-defense quality.', english)
    : zh('以上是赛季场均统计；球权、上场时间与球队角色不同，不能仅凭单项高低决定谁更强。需要双方直接面对的表现，可继续问“看他们的直接对位”。', 'These are season averages. Usage, minutes and roles differ, so a single metric does not establish the better player. Ask “their direct matchup” for possessions against each other.', english);
  return {
    title: zh(`${players[0].shortName} × ${players[1].shortName} · ${defensive ? '防守数据比较' : '赛季数据比较'}`, `${players[0].shortName} × ${players[1].shortName} · ${defensive ? 'defensive stats' : 'season comparison'}`, english),
    body: `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)}\n\n${lines.join('\n\n')}\n\n${caveat}${sourceNote(data, 'player', season, english)}`,
    action: { label: zh('打开双人比较', 'Open player comparison', english), href: `/comparison?leftPlayer=${encoded(players[0].id)}&rightPlayer=${encoded(players[1].id)}&season=${encoded(season)}&type=${type}` },
  };
}

type StatMetric = { field: keyof PlayerStats; zh: string; en: string; percent?: boolean; attemptField?: 'threePointersAttemptedPerGame' | 'fieldGoalsAttemptedPerGame' | 'freeThrowsAttemptedPerGame'; minimumAttempts?: number };
function statisticalMetric(query: string): StatMetric | undefined {
  if (/真实命中|true\s*shoot|\bts%/i.test(query)) return { field: 'trueShootingPercentage', zh: '真实命中率', en: 'TS%', percent: true, attemptField: 'fieldGoalsAttemptedPerGame', minimumAttempts: 5 };
  if (/三分.*命中率|three.*percent|3p%/i.test(query)) return { field: 'threePointPercentage', zh: '三分命中率', en: '3P%', percent: true, attemptField: 'threePointersAttemptedPerGame', minimumAttempts: 1.5 };
  if (/投篮.*命中率|field.?goal.*percent|fg%/i.test(query)) return { field: 'fieldGoalPercentage', zh: '投篮命中率', en: 'FG%', percent: true, attemptField: 'fieldGoalsAttemptedPerGame', minimumAttempts: 5 };
  if (/罚球.*命中率|free.?throw.*percent|ft%/i.test(query)) return { field: 'freeThrowPercentage', zh: '罚球命中率', en: 'FT%', percent: true, attemptField: 'freeThrowsAttemptedPerGame', minimumAttempts: 2 };
  if (/三分|three|3pm/i.test(query)) return { field: 'threePointersMadePerGame', zh: '场均三分命中数', en: '3PM per game' };
  if (/助攻|assists?|apg/i.test(query)) return { field: 'assistsPerGame', zh: '场均助攻', en: 'Assists per game' };
  if (/篮板|rebounds?|rpg/i.test(query)) return { field: 'reboundsPerGame', zh: '场均篮板', en: 'Rebounds per game' };
  if (/抢断|steals?|spg/i.test(query)) return { field: 'stealsPerGame', zh: '场均抢断', en: 'Steals per game' };
  if (/盖帽|blocks?|bpg/i.test(query)) return { field: 'blocksPerGame', zh: '场均盖帽', en: 'Blocks per game' };
  if (/失误|turnovers?|tov/i.test(query)) return { field: 'turnoversPerGame', zh: '场均失误', en: 'Turnovers per game' };
  if (/得分|scoring|points|ppg/i.test(query)) return { field: 'pointsPerGame', zh: '场均得分', en: 'Points per game' };
  return undefined;
}

function statisticalRankings(data: Dataset, query: string, english: boolean, metric: StatMetric): ScoutResult {
  const { season, type } = period(query, data);
  const minimumGames = Math.max(1, Math.min(82, Number(query.match(/(?:至少|不低于|min(?:imum)?)\s*(\d{1,2})\s*(?:场|games?)/i)?.[1] ?? (type === 'playoffs' ? 3 : 10))));
  const ascending = /最低|最少|least|lowest|fewest/i.test(query);
  const candidates = data.players.flatMap((player) => {
    const stats = statsFor(data, player.id, season, type);
    const value = stats?.[metric.field];
    if (!stats || stats.gamesPlayed < minimumGames || typeof value !== 'number' || !Number.isFinite(value)) return [];
    if (metric.attemptField && (stats[metric.attemptField] == null || stats[metric.attemptField]! < metric.minimumAttempts!)) return [];
    return [{ player, stats, value }];
  }).sort((a, b) => (ascending ? a.value - b.value : b.value - a.value) || b.stats.gamesPlayed - a.stats.gamesPlayed);
  const count = scoutResultCount(query);
  const rows = candidates.slice(0, count);
  const label = zh(metric.zh, metric.en, english);
  const qualifier = metric.attemptField ? zh(`；场均相关出手至少 ${metric.minimumAttempts} 次`, `; at least ${metric.minimumAttempts} relevant attempts per game`, english) : '';
  const body = rows.length ? rows.map((row, index) => `${index + 1}. ${row.player.shortName} · ${teamName(data, row.player, english)} — ${metric.percent ? safePercent(row.value) : safeRate(row.value)} · ${row.stats.gamesPlayed} ${zh('场', 'games', english)}`).join('\n') : zh('当前筛选没有合格的球员统计。可降低出场门槛，或切换有数据的赛季。', 'No qualified player stats for this filter. Lower the games minimum or choose a covered season.', english);
  return {
    title: zh(`${label} · ${ascending ? '最低' : '前'} ${count} 位`, `${label} · ${ascending ? 'bottom' : 'top'} ${count}`, english),
    body: `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)} · ${zh(`至少 ${minimumGames} 场`, `Minimum ${minimumGames} games`, english)}${qualifier}\n${body}\n\n${zh('按当前已发布的球员统计排序，不是官方资格榜单；缺失值不参与排名。', 'Ranked within published player stats, not an official qualification leaderboard; missing values are excluded.', english)}${sourceNote(data, 'player', season, english)}`,
    action: { label: zh('查看球员数据表', 'View player stats', english), href: `/players?season=${encoded(season)}&type=${type}` },
  };
}

const sourceNote = (data: Dataset, source: Parameters<typeof scoutSourceNote>[1], season: string, english: boolean) =>
  `\n\n${scoutSourceNote(data, source, season, english)}`;

function directComparison(data: Dataset, players: Player[], query: string, english: boolean): ScoutResult {
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
      zh(`${left.shortName} 进攻面对 ${right.shortName}：${safeRate(leftRate)} 分 / 100 直接对位回合，${leftTotal?.matchupPossessions ?? 0} 回合（${sampleLabel(getSampleQuality(leftTotal?.matchupPossessions ?? 0), false)}）。`, `${left.shortName} on offense vs ${right.shortName}: ${safeRate(leftRate)} points / 100 direct matchup possessions, ${leftTotal?.matchupPossessions ?? 0} possessions (${sampleLabel(getSampleQuality(leftTotal?.matchupPossessions ?? 0), true)}).`, english),
      zh(`${right.shortName} 进攻面对 ${left.shortName}：${safeRate(rightRate)} 分 / 100 直接对位回合，${rightTotal?.matchupPossessions ?? 0} 回合（${sampleLabel(getSampleQuality(rightTotal?.matchupPossessions ?? 0), false)}）。`, `${right.shortName} on offense vs ${left.shortName}: ${safeRate(rightRate)} points / 100 direct matchup possessions, ${rightTotal?.matchupPossessions ?? 0} possessions (${sampleLabel(getSampleQuality(rightTotal?.matchupPossessions ?? 0), true)}).`, english),
      zh(`每条记录至少 ${minimum} 回合。对位归属会受到换防、协防和阵容影响；这不是完整的个人防守评价。`, `Each record meets the ${minimum}-possession minimum. Switching, help defense and lineups affect matchup attribution; this is not a complete individual defensive grade.`, english),
    ].join('\n');
  return {
    title: zh(`${left.shortName} × ${right.shortName} 对位`, `${left.shortName} × ${right.shortName} matchup`, english),
    body: body + sourceNote(data, 'matchup', season, english),
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
  const selected = rows.slice(0, scoutResultCount(query));
  const body = selected.length
    ? selected.map((row, index) => `${index + 1}. ${row.player.shortName} — ${safeRate(row.metric)} ${zh('分 / 100 直接对位回合', 'points / 100 direct matchup possessions', english)} · ${row.possessions} ${zh('回合', 'poss.', english)} · ${sampleLabel(getSampleQuality(row.possessions), english)}`).join('\n')
    : zh(`在 ${season} 当前筛选和至少 ${minimum} 回合的门槛下，没有找到 ${player.shortName} 的对位记录。`, `No matchup rows found for ${player.shortName} in ${season} at the ${minimum}-possession minimum.`, english);
  return {
    title: zh(`${player.shortName} 的${restrictive ? '样本中低得分' : '样本中高得分'}对位`, `${player.shortName} ${restrictive ? 'lowest-scoring' : 'highest-scoring'} covered matchups`, english),
    body: body + zh(`\n\n每条记录至少 ${minimum} 回合，再按防守者汇总并排序。换防、协防、阵容和对手出手选择都会影响这一数字；不能据此判断谁是更好的防守者。`, `\n\nRecords meet the ${minimum}-possession minimum before aggregation by defender. Switching, help defense, lineups and shot selection affect this number; it does not rank individual defenders.`, english) + sourceNote(data, 'matchup', season, english),
    action: { label: zh('打开联盟对位', 'Open matchup explorer', english), href: `/matchups?player=${encoded(player.id)}&season=${encoded(season)}&type=${type}&perspective=offense&minPossessions=${minimum}` },
  };
}

function rankings(data: Dataset, query: string, english: boolean): ScoutResult {
  const { season, type, minimum } = period(query, data);
  const defensive = /防守|限制|对手得分|defen|opponent|allow/i.test(query);
  const metric = defensive ? 'defense' : 'offense';
  const rows = getRankings(data, { season, type, metric, minPossessions: 0 }).filter((row) => {
    const value = defensive ? row.defense : row.offense;
    const sample = defensive ? row.defensePossessions : row.offensePossessions;
    return value !== null && Number.isFinite(value) && sample > 0 && sample >= minimum;
  }).slice(0, scoutResultCount(query));
  const items = rows.map((row, index) => {
    const value = metric === 'defense' ? row.defense : row.offense;
    const possessions = defensive ? row.defensePossessions : row.offensePossessions;
    return `${index + 1}. ${row.player.shortName} (${teamName(data, row.player, english)}) — ${safeRate(value)} ${zh('分 / 100 对位回合', 'pts / 100 matchup poss.', english)} · ${safeRate(possessions)} ${zh('回合', 'poss.', english)} · ${sampleLabel(getSampleQuality(possessions), english)}`;
  });
  const caveat = defensive ? zh('\n防守口径为对手每 100 个对位回合得分；较低仅表示当前覆盖样本中的对手得分较少，不能单独评定个人防守能力。', '\nDefense is opponent points per 100 matchup possessions; lower means fewer points allowed in this covered sample, not a complete individual defensive grade.', english) : '';
  return {
    title: zh(`排行榜 · ${defensive ? '样本对手得分' : '进攻对位得分'}`, `Rankings · ${defensive ? 'opponent scoring in sample' : 'offensive matchup scoring'}`, english),
    body: `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)} · ${zh(`球员${defensive ? '防守' : '进攻'}汇总至少 ${minimum} 回合`, `minimum ${minimum} aggregated ${defensive ? 'defensive' : 'offensive'} possessions`, english)}\n${items.length ? items.join('\n') : zh('当前赛季和样本门槛下没有合格记录。', 'No qualified rows for the selected season and sample threshold.', english)}${caveat}${sourceNote(data, 'matchup', season, english)}`,
    action: { label: zh('查看完整排行榜', 'View full rankings', english), href: `/rankings?season=${encoded(season)}&type=${type}&metric=${metric}&order=${defensive ? 'asc' : 'desc'}&minPossessions=${minimum}` },
  };
}

function playTypes(data: Dataset, player: Player, query: string, english: boolean): ScoutResult {
  const { season, type } = period(query, data);
  const defensive = /防守|defen/i.test(query);
  const group = defensive ? 'defensive' : 'offensive';
  const rows = getPlayerPlayTypes(data, player.id, { season, type }).filter((row) => row.grouping === group)
    .sort((a, b) => b.possessions - a.possessions).slice(0, 5);
  const items = rows.map((row, index) => `${index + 1}. ${playTypeName(row.playType, english)} — ${row.possessions.toFixed(1)} ${zh('回合', 'poss.', english)} · ${safeRate(row.pointsPerPossession, 2)} ${zh('分 / 回合', 'pts / poss.', english)} · ${row.percentile == null ? '—' : `${Math.round(row.percentile * 100)}%`}`);
  return {
    title: zh(`${player.shortName} · ${defensive ? '防守' : '进攻'}打法`, `${player.shortName} · ${defensive ? 'defensive' : 'offensive'} play types`, english),
    body: `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)}\n${items.length ? items.join('\n') : zh(`当前没有 ${player.shortName} 在 ${season} 的该类打法记录。`, `No ${defensive ? 'defensive' : 'offensive'} play-type rows for ${player.shortName} in ${season}.`, english)}${sourceNote(data, 'playerPlaytype', season, english)}`,
    action: { label: zh('打开打法分析', 'Open play-type analysis', english), href: `/playtypes/${encoded(player.id)}?season=${encoded(season)}&type=${type}` },
  };
}

function playerSummary(data: Dataset, player: Player, query: string, english: boolean): ScoutResult {
  const { season, type } = period(query, data);
  const stats = statsFor(data, player.id, season, type);
  const defensive = /防守|defen|抢断|盖帽|steal|block/i.test(query);
  if (!stats) return {
    title: zh(`${player.shortName} · 数据概览`, `${player.shortName} · player overview`, english),
    body: zh(`找到球员，但当前数据集没有 ${season} ${type === 'playoffs' ? '季后赛' : '常规赛'} 的球员统计记录。`, `Player found, but no ${season} ${type === 'playoffs' ? 'playoff' : 'regular-season'} stats are available in this dataset.`, english) + sourceNote(data, 'player', season, english),
    action: { label: zh('打开球员页面', 'Open player profile', english), href: `/players/${encoded(player.id)}?season=${encoded(season)}&type=${type}` },
  };
  return {
    title: zh(`${player.shortName} · ${season} 球员数据`, `${player.shortName} · ${season} player stats`, english),
    body: [
      `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)} · ${zh('球队 / 位置', 'Team / position', english)}：${teamName(data, player, english)} / ${english ? player.position : ({ G: '后卫', F: '前锋', C: '中锋', 'G-F': '锋卫', 'F-C': '内线', Unknown: '暂未确认' })[player.position]}`,
      `${zh('场均得分 / 篮板 / 助攻', 'PPG / RPG / APG', english)}：${safeRate(stats.pointsPerGame)} / ${safeRate(stats.reboundsPerGame)} / ${safeRate(stats.assistsPerGame)}`,
      `${zh('投篮 / 三分命中率', 'FG% / 3P%', english)}：${safePercent(stats.fieldGoalPercentage)} / ${safePercent(stats.threePointPercentage)} · ${stats.gamesPlayed} ${zh('场', 'games', english)}`,
      ...(stats.minutesPerGame != null ? [zh(`场均上场 ${safeRate(stats.minutesPerGame)} 分钟。`, `${safeRate(stats.minutesPerGame)} minutes per game.`, english)] : []),
      ...(stats.trueShootingPercentage != null ? [zh(`真实命中率 ${safePercent(stats.trueShootingPercentage)}。`, `True shooting ${safePercent(stats.trueShootingPercentage)}.`, english)] : []),
      ...(defensive ? [
        zh(`防守统计：场均抢断 ${safeRate(stats.stealsPerGame)}、盖帽 ${safeRate(stats.blocksPerGame)}、防守篮板 ${safeRate(stats.defensiveReboundsPerGame)}。`, `Defensive stats: ${safeRate(stats.stealsPerGame)} SPG, ${safeRate(stats.blocksPerGame)} BPG, ${safeRate(stats.defensiveReboundsPerGame)} defensive RPG.`, english),
        zh('这些统计只覆盖部分防守贡献；无法据此评价领防、换防、协防和真实防守影响。', 'These stats cover only part of defense; they do not measure on-ball, switching, help defense or overall defensive impact.', english),
      ] : []),
      ...(/为什么|原因|适合|表现|why|reason|fit|how good/i.test(query) ? [zh('这些是已记录的产量、效率和出场时间；目前缺少完整战术、阵容和伤病语境，不能单凭这些指标解释表现成因。', 'These describe recorded output, efficiency and minutes. Without full scheme, lineup and injury context they do not establish why a player performed this way.', english)] : []),
    ].join('\n') + sourceNote(data, 'player', season, english),
    action: { label: zh('打开球员画像', 'Open player profile', english), href: `/players/${encoded(player.id)}?season=${encoded(season)}&type=${type}` },
  };
}

function recentForm(data: Dataset, player: Player, query: string, english: boolean): ScoutResult {
  const { season, type } = period(query, data);
  const requested = Number(query.match(/(?:最近|近|last|recent)\s*(\d{1,2})\s*(?:场|games?)?/i)?.[1] ?? 5);
  const count = Math.max(1, Math.min(20, requested));
  const logs = (data.daily ?? []).filter((row) => row.playerId === player.id && row.season === season && row.seasonType === type)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
  const stats = statsFor(data, player.id, season, type);
  const average = (field: 'points' | 'rebounds' | 'assists') => logs.reduce((sum, row) => sum + row[field], 0) / logs.length;
  const difference = stats && logs.length ? average('points') - stats.pointsPerGame : 0;
  const deltaText = Math.abs(difference) < 0.05 ? zh('与赛季场均持平', 'equal to the season scoring average', english)
    : zh(`${difference > 0 ? '高于' : '低于'}赛季场均 ${safeRate(Math.abs(difference))} 分`, `${safeRate(Math.abs(difference))} PPG ${difference > 0 ? 'above' : 'below'} the season average`, english);
  const seasonComparison = stats ? zh(`赛季场均 ${safeRate(stats.pointsPerGame)} 分，近 ${logs.length} 场${deltaText}。`, `Season average: ${safeRate(stats.pointsPerGame)} PPG; the recent sample is ${deltaText}. `, english) : '';
  const body = logs.length
    ? zh(`最近 ${logs.length} 场已记录比赛（${logs.at(-1)!.date} 至 ${logs[0].date}）：场均 ${safeRate(average('points'))} 分、${safeRate(average('rebounds'))} 篮板、${safeRate(average('assists'))} 助攻。${seasonComparison}\n只计算已发布比赛日志；${logs.length < count ? `请求 ${count} 场，当前仅找到 ${logs.length} 场。` : ''}短期样本不说明未来表现或变化原因。`, `Last ${logs.length} recorded games (${logs.at(-1)!.date} to ${logs[0].date}): ${safeRate(average('points'))} PPG, ${safeRate(average('rebounds'))} RPG, ${safeRate(average('assists'))} APG. ${seasonComparison}Only published game logs are counted. ${logs.length < count ? `Requested ${count}, found ${logs.length}. ` : ''}A short sample does not explain causes or predict future form.`, english)
    : zh(`当前目录没有 ${player.shortName} 在 ${season} ${type === 'playoffs' ? '季后赛' : '常规赛'}的比赛日志，无法计算近 ${count} 场表现。`, `No ${season} ${type === 'playoffs' ? 'playoff' : 'regular-season'} game logs for ${player.shortName} are published, so the last ${count} games cannot be calculated.`, english);
  return {
    title: zh(`${player.shortName} · 近况`, `${player.shortName} · recent form`, english),
    body: `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)}\n${body}${sourceNote(data, 'player', season, english)}`,
    action: { label: zh('查看球员比赛日志', 'View player game logs', english), href: `/players/${encoded(player.id)}?season=${encoded(season)}&type=${type}` },
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
    const teamName = english ? team.name : team.chineseName;
    if (!stats) return `${teamName} (${team.abbreviation}): ${zh('当前数据集没有该赛季球队统计记录。', 'No team stats for this season in the current dataset.', english)}`;
    const playTypes = playtypeRequested
      ? getTeamPlayTypes(data, team.id, { season, type }).filter((row) => row.grouping === (/防守|defen/i.test(query) ? 'defensive' : 'offensive')).sort((a, b) => b.possessions - a.possessions).slice(0, 3)
      : [];
    const playSummary = playtypeRequested && !playTypes.length
      ? zh('球队打法快照当前没有可用记录。', 'No team play-type snapshot is available.', english)
      : playTypes.map((row) => `${playTypeName(row.playType, english)} (${safeRate(row.possessions)} ${zh('回合', 'poss.', english)}, ${safeRate(row.pointsPerPossession, 2)} ${zh('分/回合', 'pts/poss.', english)})`).join(' · ');
    return `${teamName} (${team.abbreviation}): ${fields(stats)}${playtypeRequested ? `\n${zh('主要打法', 'Leading play types', english)}: ${playSummary}` : ''}`;
  });
  const isComparison = rows.length > 1;
  return {
    title: isComparison
      ? zh(`${rows[0].team.chineseName} × ${rows[1].team.chineseName} 球队对比`, `${rows[0].team.name} × ${rows[1].team.name} team comparison`, english)
      : zh(`${rows[0].team.chineseName} · 球队分析`, `${rows[0].team.name} · team analysis`, english),
    body: `${season} ${type === 'playoffs' ? zh('季后赛', 'playoffs', english) : zh('常规赛', 'regular season', english)}\n${notes.join('\n')}\n\n${zh('效率与节奏来自已发布球队快照，不能单凭这些指标解释比赛结果。', 'Ratings and pace come from the published team snapshot and alone do not explain game results.', english)}${sourceNote(data, 'team', season, english)}${playtypeRequested ? sourceNote(data, 'teamPlaytype', season, english) : ''}`,
    action: isComparison
      ? { label: zh('打开球队对比', 'Open team comparison', english), href: `/team/compare?left=${encoded(rows[0].team.id)}&right=${encoded(rows[1].team.id)}&season=${encoded(season)}&type=${type}` }
      : { label: zh('打开球队分析', 'Open team analysis', english), href: `/team/pk?team=${encoded(rows[0].team.id)}&season=${encoded(season)}&type=${type}` },
  };
}

const NEWS_INTENT = /新闻|消息|报道|场外|动态|news|headlines?|stories|articles?|off.?court/i;
export function isScoutNewsQuery(query: string): boolean { return NEWS_INTENT.test(query); }
const NEWS_FILLER = /新闻|消息|报道|赛场外|场外|最新动态|动态|最近|最新|今日|今天|球员|球队|给我|帮我|查一下|查询|看看|一下|相关|汇总|有没有|有什么|告诉我|总结|的|nba|\b(?:news|headlines?|stories|articles?|off.?court|please|show|find|about|what|are|the|latest|for|me)\b/gi;

function newsSearch(data: Dataset, query: string, english: boolean, feed?: ScoutNewsFeed): ScoutResult {
  if (!feed?.articles?.length) return {
    title: zh('NBA 新闻暂不可用', 'NBA news is unavailable', english),
    body: zh('新闻目录目前没有可用内容。请稍后重试，或打开新闻页查看来源状态。', 'The published news catalogue is unavailable right now. Try again later or open the news desk to check the source status.', english),
    action: { label: zh('打开新闻', 'Open NBA news', english), href: '/news' },
  };
  const terms = (query.replace(NEWS_FILLER, ' ').toLocaleLowerCase().match(/[a-z0-9]{3,}|[\u4e00-\u9fff]{2,}/g) ?? []).map(normalize);
  const resolvedPlayers = resolveScoutPlayers(data, query);
  const partialPlayers = terms.length ? data.players.filter((player) => {
    const names = playerNames(player).map(normalize);
    return terms.some((term) => term.length >= 2 && names.some((name) => name.includes(term)));
  }) : [];
  const players = resolvedPlayers.length ? resolvedPlayers : partialPlayers;
  const teams = resolveScoutTeams(data, query);
  const playerNameTerms = players.flatMap((player) => playerNames(player).map(normalize));
  const playerTerms = [...playerNameTerms.filter((term) => term.length > 2 || /[\u4e00-\u9fff]/.test(term)), ...terms.filter((term) => playerNameTerms.some((name) => name.includes(term)))];
  const teamNameTerms = teams.flatMap((team) => [team.name, team.chineseName, team.abbreviation, team.id, ...(teamAliases[team.abbreviation] ?? [])].map(normalize));
  const teamTerms = [...teamNameTerms.filter((term) => term.length > 2 || /[\u4e00-\u9fff]/.test(term)), ...terms.filter((term) => teamNameTerms.some((name) => name.includes(term)))];
  // Entity and topic are separate filters: an injury query must not return every story about that player.
  const topics = [
    { query: /伤病|受伤|缺阵|复出|injur|availability|questionable/i, words: ['injur', 'questionable', 'ruled out', 'sidelined', 'knee', 'ankle', 'finger', '伤病', '受伤', '缺阵', '复出'] },
    { query: /交易|trade|trading/i, words: ['trade', 'trading', '交易'] },
    { query: /续约|extension|extend/i, words: ['extension', 'extend', '续约'] },
    { query: /签约|signing|signed|contract/i, words: ['sign', 'contract', '签约', '合同'] },
    { query: /季后赛|playoff/i, words: ['playoff', '季后赛'] },
  ].filter((topic) => topic.query.test(query));
  const topicAliases: Record<string, string[]> = {
    '交易': ['trade'], '伤病': ['injur'], '受伤': ['injur'], '续约': ['contract', 'extension'], '签约': ['sign', 'contract'],
    '季后赛': ['playoff'], '湖人': ['lakers'], '勇士': ['warriors'], '凯尔特人': ['celtics'], '火箭': ['rockets'], '骑士': ['cavaliers', 'cavs'],
  };
  const searchTerms = [...new Set(terms.flatMap((term) => [term, ...(topicAliases[term] ?? [])]))];
  const filtered = feed.articles.filter((article) => {
    const haystack = normalize([article.title, article.titleZh ?? '', article.summary ?? '', article.summaryZh ?? '', article.author ?? '', ...(article.categories ?? [])].join(' '));
    if (playerTerms.length && !playerTerms.some((term) => term.length > 1 && haystack.includes(term))) return false;
    if (teamTerms.length && !teamTerms.some((term) => haystack.includes(term))) return false;
    if (topics.some((topic) => !topic.words.some((word) => haystack.includes(normalize(word))))) return false;
    if (!playerTerms.length && !teamTerms.length && searchTerms.length && !searchTerms.some((term) => haystack.includes(normalize(term)))) return false;
    return /^https:\/\//i.test(article.url) && Boolean(article.title);
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 5);
  const date = feed.updatedAt && Number.isFinite(Date.parse(feed.updatedAt))
    ? new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(feed.updatedAt)) + ' UTC'
    : zh('未知', 'unknown', english);
  const stale = !feed.updatedAt || !Number.isFinite(Date.parse(feed.updatedAt)) || Date.now() - Date.parse(feed.updatedAt) > 36 * 60 * 60 * 1000;
  const body = filtered.length
    ? filtered.map((article, index) => {
      const published = Number.isFinite(Date.parse(article.publishedAt))
        ? new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(article.publishedAt))
        : zh('日期未知', 'date unavailable', english);
      const headline = english ? article.title : article.titleZh || '新闻标题翻译暂不可用';
      const summary = (english ? article.summary : article.summaryZh || (article.summary ? '新闻摘要翻译暂不可用，可点击来源查看原文。' : ''))?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220) ?? '';
      return `${index + 1}. ${headline}\n${published}${article.author ? ` · ${article.author}` : ''}${!english && article.titleZh ? ' · 机器翻译' : ''}${summary ? `\n${summary}${article.summary && article.summary.length > 220 ? '…' : ''}` : ''}`;
    }).join('\n\n')
    : zh('在当前已发布的新闻目录中，没有找到与该球员或主题匹配的报道。可以试试球员英文名、球队名或更宽泛的关键词。', 'No stories in the published feed matched that player or topic. Try the player’s English name, team name or a broader keyword.', english);
  return {
    title: players.length ? zh(`${players[0].shortName} · NBA 新闻`, `${players[0].shortName} · NBA news`, english) : teams.length
      ? zh(`${teamAliases[teams[0].abbreviation]?.find((name) => /[\u4e00-\u9fff]/.test(name) && name.length > 3) ?? teams[0].chineseName} · NBA 新闻`, `${teams[0].name} · NBA news`, english)
      : zh('NBA 新闻检索', 'NBA news search', english),
    body: `${body}\n\n${zh(`来源：${feed.source ?? '已发布 ESPN NBA 新闻目录'} · 新闻源更新时间：${date}${stale ? ' · 数据可能已过期' : ''}。新闻目录按发布流程更新，非逐条实时推送；伤病、交易及签约以原文和官方公告为准。`, `Source: ${feed.source ?? 'published ESPN NBA news catalogue'} · Feed updated: ${date}${stale ? ' · data may be stale' : ''}. The catalogue is refreshed through the publishing pipeline, not streamed live. Check the original story and official announcements for injury, trade and signing status.`, english)}`,
    action: { label: zh('打开新闻中心', 'Open NBA news desk', english), href: '/news' },
    sources: filtered.map((article) => ({ label: english ? article.title : article.titleZh || '阅读新闻原文', href: article.url })),
  };
}

export function answerScoutQuestion(data: Dataset, query: string, english: boolean, news?: ScoutNewsFeed): ScoutResult {
  if (isScoutNewsQuery(query)) return newsSearch(data, query, english, news);
  const requestedSeason = query.match(/20\d{2}-\d{2}/)?.[0];
  if (requestedSeason && !scoutSeasons(data).includes(requestedSeason)) return {
    title: zh('所选赛季暂无数据', 'Season not available', english),
    body: zh(`当前没有 ${requestedSeason} 的可查询赛季数据。已发布赛季：${scoutSeasons(data).join('、') || '暂无'}。请指定其中一个赛季。`, `No queryable season data is published for ${requestedSeason}. Available seasons: ${scoutSeasons(data).join(', ') || 'none'}. Please choose an available season.`, english),
    action: { label: zh('查看数据来源', 'View data sources', english), href: '/sources' },
  };
  if (/伤病|受伤|缺阵|复出|能(?:出场|上场|打|上)|injur|out tonight|available tonight|play tonight|今晚.*(赢|胜)|谁会赢|预测|胜率|赔率|投注|betting|predict|live score|实时比分/i.test(query)) return {
    title: zh('需要实时核验的问题', 'This needs current verification', english),
    body: zh('当前 Agent 没有经过核验的实时伤病、赛前出场名单或比赛预测数据，不能确认这项判断。可在新闻中心查找相关报道，并以球队或联盟官方公告为准。', 'This Agent has no verified live injury report, game-day availability list or prediction data, so it cannot confirm that claim. Check the news desk and official team or league announcements.', english),
    action: { label: zh('查看 NBA 新闻', 'Open NBA news', english), href: '/news' },
  };
  const teams = resolveScoutTeams(data, query);
  const players = resolveScoutPlayers(data, query);
  const isComparison = /对比|比较|vs\.?|versus|compare|head.?to.?head|交手/i.test(query);
  if (teams.length && !players.length && (isComparison || /球队|team|pace|节奏|阵容|打法/i.test(query))) return teamSummary(data, teams.slice(0, 2), query, english);
  const directIntent = /直接对位|对位|面对|交手|matchups?|head.?to.?head|guarded by|against/i.test(query);
  if (players.length > 1) return directIntent ? directComparison(data, players.slice(0, 2), query, english) : playerComparison(data, players.slice(0, 2), query, english);
  const rankingIntent = /排行|榜|排名|top\s*\d|前\s*[\d一二两三四五六七八九十]+\s*(?:名|位|人)?|leaders?|rankings?|最高|最低|最多|最少|most|highest|lowest|least/i.test(query);
  if (rankingIntent && !players.length) {
    const metric = statisticalMetric(query);
    const matchupRanking = /对位|对手得分|限制|防守|matchup|opponent|allow|defen|效率/i.test(query) && !/命中率|shoot|fg%|3p%|ts%|ft%/i.test(query);
    return metric && !matchupRanking ? statisticalRankings(data, query, english, metric) : rankings(data, query, english);
  }
  if (players[0] && /打法|play.?type|isolation|transition|挡拆|单打|定点/i.test(query)) return playTypes(data, players[0], query, english);
  if (players[0] && /谁|对位|限制|最强|最弱|最差|最难|matchup|limit|restrict|opponent/i.test(query)) return matchupLeaders(data, players[0], query, english);
  if (players[0] && /最近\s*\d{1,2}\s*场|近\s*\d{1,2}\s*场|近况|最近表现|last\s*\d{1,2}\s*games?|recent(?:\s*\d{1,2}\s*games?|\s+form)/i.test(query)) return recentForm(data, players[0], query, english);
  if (players[0]) return playerSummary(data, players[0], query, english);
  const matches = searchPlayers(data, query).slice(0, 3);
  if (matches.length) return {
    title: zh('找到相关球员', 'Players found', english),
    body: matches.map((player) => `${player.shortName} · ${player.teamAbbreviation} · ${player.position}`).join('\n') + zh('\n\n请在问题中使用完整球员姓名，或直接点击下方搜索。', '\n\nUse a player name in your question, or open player search below.', english),
    action: { label: zh('查看球员目录', 'Open player directory', english), href: '/players' },
  };
  return {
    title: zh('我可以帮你查 NBA 对位数据', 'Ask about NBA matchup data', english),
    body: zh('可以查球员赛季数据和近几场表现、比较两名球员、查询直接对位、得分 / 篮板 / 助攻等榜单、打法与球队效率，以及带原文链接的 NBA 新闻。试试“库里最近5场”“比较库里和詹姆斯”“助攻榜前10”“谁最能限制库里”。当前回答依据已发布数据，实时伤病与赛前名单需要另外核验。', 'Ask for player season stats or recent games, two-player comparisons, direct matchups, scoring / rebounding / assist leaders, play types, team ratings or NBA news with original links. Try “Curry last 5 games”, “compare Curry and LeBron”, “top 10 assist leaders” or “who limits Curry?”. Answers use published data; live injuries and game-day availability require separate verification.', english),
  };
}
