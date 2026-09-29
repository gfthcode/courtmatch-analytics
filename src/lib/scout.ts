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
import { DEMO_DATA } from './data';

export type ScoutAction = { label: string; href: string };
export type ScoutSource = { label: string; href: string };
export type ScoutResult = { title: string; body: string; action?: ScoutAction; sources?: ScoutSource[] };
export type ScoutNewsArticle = { id: string; title: string; summary?: string; url: string; publishedAt: string; author?: string; categories?: string[] };
export type ScoutNewsFeed = { source?: string; updatedAt?: string; articles: ScoutNewsArticle[] };

const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\s·.'’-]/g, '');
const zh = (text: string, en: string, english: boolean) => english ? en : text;
const encoded = (value: string) => encodeURIComponent(value);

function playerNames(player: Player): string[] {
  const aliases = DEMO_DATA.players.find((candidate) => normalize(candidate.name) === normalize(player.name));
  return [player.name, player.shortName, player.chineseName, ...player.aliases, aliases?.chineseName, ...(aliases?.aliases ?? [])].filter((name): name is string => Boolean(name));
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

function resolvePlayers(data: Dataset, query: string): Player[] {
  const normalized = normalize(query);
  const variants = data.players.flatMap((player) => playerNames(player)
    .map((name) => ({ player, name: normalize(name) })))
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
    const names = [team.name, team.chineseName, team.abbreviation, team.id, ...(teamAliases[team.abbreviation] ?? [])].map(normalize).sort((a, b) => b.length - a.length);
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

const NEWS_INTENT = /新闻|消息|报道|场外|赛场外|最新动态|news|headlines?|stories|articles?|off.?court/i;
const NEWS_FILLER = /新闻|消息|报道|场外|赛场外|最新动态|最近|最新|今日|今天|球员|nba|news|headlines?|stories|articles?|off.?court|please|show|find|about|what|are|the|latest|for/gi;

function newsSearch(data: Dataset, query: string, english: boolean, feed?: ScoutNewsFeed): ScoutResult {
  if (!feed?.articles?.length) return {
    title: zh('NBA 新闻暂不可用', 'NBA news is unavailable', english),
    body: zh('新闻目录目前没有可用内容。请稍后重试，或打开新闻页查看来源状态。', 'The published news catalogue is unavailable right now. Try again later or open the news desk to check the source status.', english),
    action: { label: zh('打开新闻', 'Open NBA news', english), href: '/news' },
  };
  const queryTerms = normalize(query.replace(NEWS_FILLER, ''));
  const terms = queryTerms.match(/[a-z0-9]{3,}|[\u4e00-\u9fff]{2,}/g) ?? [];
  const resolvedPlayers = resolvePlayers(data, query);
  const partialPlayers = terms.length ? data.players.filter((player) => {
    const names = playerNames(player).map(normalize);
    return terms.some((term) => term.length >= 2 && names.some((name) => name.includes(term)));
  }) : [];
  const players = resolvedPlayers.length ? resolvedPlayers : partialPlayers;
  const teams = resolveTeams(data, query);
  const playerNameTerms = players.flatMap((player) => playerNames(player).map(normalize));
  const playerTerms = [...playerNameTerms.filter((term) => term.length > 2 || /[\u4e00-\u9fff]/.test(term)), ...terms.filter((term) => playerNameTerms.some((name) => name.includes(term)))];
  const teamNameTerms = teams.flatMap((team) => [team.name, team.chineseName, team.abbreviation, team.id, ...(teamAliases[team.abbreviation] ?? [])].map(normalize));
  const teamTerms = [...teamNameTerms.filter((term) => term.length > 2 || /[\u4e00-\u9fff]/.test(term)), ...terms.filter((term) => teamNameTerms.some((name) => name.includes(term)))];
  const topicAliases: Record<string, string[]> = {
    '交易': ['trade'], '伤病': ['injur'], '受伤': ['injur'], '续约': ['contract', 'extension'], '签约': ['sign', 'contract'],
    '季后赛': ['playoff'], '湖人': ['lakers'], '勇士': ['warriors'], '凯尔特人': ['celtics'], '火箭': ['rockets'], '骑士': ['cavaliers', 'cavs'],
  };
  const searchTerms = [...new Set(terms.flatMap((term) => [term, ...(topicAliases[term] ?? [])]))];
  const filtered = feed.articles.filter((article) => {
    const haystack = normalize([article.title, article.summary ?? '', article.author ?? '', ...(article.categories ?? [])].join(' '));
    if (playerTerms.length && !playerTerms.some((term) => term.length > 1 && haystack.includes(term))) return false;
    if (teamTerms.length && !teamTerms.some((term) => haystack.includes(term))) return false;
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
        ? new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(article.publishedAt))
        : zh('日期未知', 'date unavailable', english);
      const summary = (article.summary ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
      return `${index + 1}. ${article.title}\n${published}${article.author ? ` · ${article.author}` : ''}${summary ? `\n${summary}${article.summary && article.summary.length > 220 ? '…' : ''}` : ''}`;
    }).join('\n\n')
    : zh('在当前已发布的新闻目录中，没有找到与该球员或主题匹配的报道。可以试试球员英文名、球队名或更宽泛的关键词。', 'No stories in the published feed matched that player or topic. Try the player’s English name, team name or a broader keyword.', english);
  return {
    title: players.length ? zh(`${players[0].shortName} · NBA 新闻`, `${players[0].shortName} · NBA news`, english) : teams.length ? zh(`${teams[0].chineseName} · NBA 新闻`, `${teams[0].name} · NBA news`, english) : zh('NBA 新闻检索', 'NBA news search', english),
    body: `${body}\n\n${zh(`来源：${feed.source ?? '已发布 ESPN NBA 新闻目录'} · 新闻源更新时间：${date}${stale ? ' · 数据可能已过期' : ''}。新闻目录按发布流程更新，非逐条实时推送。`, `Source: ${feed.source ?? 'published ESPN NBA news catalogue'} · Feed updated: ${date}${stale ? ' · data may be stale' : ''}. The catalogue is refreshed through the publishing pipeline, not streamed live.`, english)}`,
    action: { label: zh('打开新闻中心', 'Open NBA news desk', english), href: '/news' },
    sources: filtered.map((article) => ({ label: article.title, href: article.url })),
  };
}

export function answerScoutQuestion(data: Dataset, query: string, english: boolean, news?: ScoutNewsFeed): ScoutResult {
  if (NEWS_INTENT.test(query)) return newsSearch(data, query, english, news);
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
    body: zh('目前支持：球员赛季数据、球员直接对位与强弱对位、攻防排行榜、球员打法、球队效率与双队对比，以及按球员或主题检索已发布的 NBA 新闻并打开原文。可使用球队全名、常见昵称、中文名或缩写。新闻目录按发布流程更新，不是逐条实时推送；不支持伤病判断、比赛预测或投注建议。', 'I can look up player season stats and matchups, offensive/defensive rankings, play types, team ratings and comparisons, and search the published NBA news feed by player or topic with links to original stories. Team full names, common nicknames, Chinese names and abbreviations are supported. The news catalogue is refreshed through the publishing pipeline, not streamed live; injury assessments, game predictions and betting advice are not supported.', english),
  };
}
