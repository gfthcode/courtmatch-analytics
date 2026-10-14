import { isScoutNewsQuery, resolveScoutPlayers, resolveScoutTeams, scoutResultCount, scoutSeasons } from './scout';
import type { Dataset, SeasonType } from './types';

export type ScoutIntent = 'player' | 'recent' | 'comparison' | 'matchup' | 'rankings' | 'playtypes' | 'team' | 'news' | 'general';
export type ScoutConversationContext = {
  playerIds: string[];
  teamIds: string[];
  season?: string;
  seasonType: SeasonType;
  intent: ScoutIntent;
  recentGames?: number;
  focus?: 'offense' | 'defense';
  rankingTopic?: string;
  resultCount?: number;
  minimumPossessions?: number;
};
export type ScoutResolvedTurn = { query: string; resolvedQuery: string; context: ScoutConversationContext; usedContext: boolean };
export type ScoutFollowUp = { label: string; query: string };

const rankingIntent = /排行|榜|排名|top\s*\d|前\s*[\d一二两三四五六七八九十]+|leaders?|rankings?|最多|最高|最低|最少|most|highest|lowest|least/i;
const recentIntent = /近\s*\d+\s*场|近况|最近表现|last\s*\d+\s*games?|recent\s*(?:form|\d+\s*games?)/i;
const referenceIntent = /(?:^|[^其])他|她|这两|上述|这个球员|该球员|\b(?:he|him|his|she|her|they|them|their|those|these)\b/i;
const continuationIntent = /^(?:那|再|改|换|继续|还有|以及|呢|至少|不低于|min(?:imum)?\b|what about|how about|then|and\b)|季后赛|常规赛|playoffs?|regular season|20\d{2}-\d{2}|^防守|^进攻|^defen|^offen/i;

function rankingTopic(query: string): string | undefined {
  if (/防守|限制|对手得分|defen|opponent|allow/i.test(query)) return '防守对位';
  if (/对位|matchup|进攻效率|offensive efficiency/i.test(query)) return '进攻对位';
  if (/真实命中|true\s*shoot|ts%/i.test(query)) return '真实命中率';
  if (/三分.*命中率|three.*percent|3p%/i.test(query)) return '三分命中率';
  if (/投篮.*命中率|field.?goal.*percent|fg%/i.test(query)) return '投篮命中率';
  if (/罚球.*命中率|free.?throw.*percent|ft%/i.test(query)) return '罚球命中率';
  if (/助攻|assists?|apg/i.test(query)) return '助攻';
  if (/篮板|rebounds?|rpg/i.test(query)) return '篮板';
  if (/抢断|steals?|spg/i.test(query)) return '抢断';
  if (/盖帽|blocks?|bpg/i.test(query)) return '盖帽';
  if (/三分|three|3pm/i.test(query)) return '三分';
  if (/失误|turnovers?|tov/i.test(query)) return '失误';
  if (/得分|scoring|points|ppg/i.test(query)) return '得分';
  return undefined;
}

/** Resolve short follow-ups from structured entities, never by replaying an old answer. */
export function resolveScoutTurn(data: Dataset, input: string, previous?: ScoutConversationContext): ScoutResolvedTurn {
  const query = input.trim();
  const explicitPlayers = resolveScoutPlayers(data, query).map((player) => player.id).slice(0, 2);
  const explicitTeams = resolveScoutTeams(data, query).map((team) => team.id).slice(0, 2);
  const wantsNews = isScoutNewsQuery(query);
  const wantsRankings = rankingIntent.test(query);
  const hasReference = referenceIntent.test(query);
  const hasNewEntity = Boolean(explicitPlayers.length || explicitTeams.length);
  const rankingModifier = wantsRankings && previous?.intent === 'rankings' && !rankingTopic(query) && /前\s*[\d一二两三四五六七八九十]+|top\s*\d/i.test(query);
  const changesTopic = (wantsNews || wantsRankings && !rankingModifier) && !hasReference;
  const comparesWithPrevious = Boolean(previous?.playerIds.length === 1 && explicitPlayers.length === 1 && explicitPlayers[0] !== previous.playerIds[0]
    && /比较|对比|对位|compare|versus|against|\bvs\b/i.test(query) && /和|跟|与|\bwith\b|\bagainst\b|\bvs\b/i.test(query));
  const canContinue = comparesWithPrevious || Boolean(previous && !hasNewEntity && !changesTopic && (hasReference || rankingModifier || continuationIntent.test(query) || recentIntent.test(query)));
  const playerIds = comparesWithPrevious ? [previous!.playerIds[0], explicitPlayers[0]] : explicitPlayers.length ? explicitPlayers : canContinue ? previous!.playerIds.filter((id) => data.players.some((player) => player.id === id)) : [];
  const teamIds = explicitTeams.length ? explicitTeams : canContinue && !playerIds.length ? previous!.teamIds.filter((id) => data.teams.some((team) => team.id === id)) : [];
  const explicitSeason = query.match(/20\d{2}-\d{2}/)?.[0];
  const season = explicitSeason ?? (canContinue ? previous?.season : undefined) ?? scoutSeasons(data)[0];
  const seasonType: SeasonType = /季后赛|playoffs?|postseason/i.test(query) ? 'playoffs' : /常规赛|regular\s*season/i.test(query) ? 'regular' : canContinue ? previous!.seasonType : 'regular';
  const focus = /防守|defen/i.test(query) ? 'defense' : /进攻|offen/i.test(query) ? 'offense' : canContinue ? previous?.focus : undefined;
  let intent: ScoutIntent = 'general';
  if (wantsNews) intent = 'news';
  else if (wantsRankings && !playerIds.length) intent = 'rankings';
  else if (teamIds.length && !playerIds.length) intent = 'team';
  else if (playerIds.length && /打法|play.?type|挡拆|单打|定点|isolation|transition/i.test(query)) intent = 'playtypes';
  else if (playerIds.length && /对位|面对|交手|限制|matchup|head.?to.?head|against|limit|restrict/i.test(query)) intent = 'matchup';
  else if (playerIds.length > 1) intent = canContinue && previous?.intent === 'matchup' ? 'matchup' : 'comparison';
  else if (playerIds.length && recentIntent.test(query)) intent = 'recent';
  else if (canContinue && previous && previous.intent !== 'general') intent = previous.intent;
  else if (playerIds.length) intent = 'player';

  const recentGames = intent === 'recent' ? Math.max(1, Math.min(20, Number(query.match(/(?:最近|近|last|recent)\s*(\d{1,2})/i)?.[1] ?? (canContinue ? previous?.recentGames : undefined) ?? 5))) : undefined;
  const topic = intent === 'rankings' ? rankingTopic(query) ?? (canContinue ? previous?.rankingTopic : undefined) ?? '进攻对位' : undefined;
  const resultCount = intent === 'rankings' || intent === 'matchup'
    ? /前\s*[\d一二两三四五六七八九十]+|top\s*\d/i.test(query) ? scoutResultCount(query) : (canContinue ? previous?.resultCount : undefined) ?? 5 : undefined;
  const minimumMatch = query.match(/(?:至少|不低于|min(?:imum)?)\s*(\d{1,4})\s*(?:回合|possessions?)/i);
  const minimumPossessions = minimumMatch ? Math.min(1000, Number(minimumMatch[1])) : canContinue ? previous?.minimumPossessions : undefined;
  const context: ScoutConversationContext = { playerIds, teamIds, season, seasonType, intent, recentGames, focus, rankingTopic: topic, resultCount, minimumPossessions };
  const entities = playerIds.map((id) => data.players.find((player) => player.id === id)!.name).join(' 和 ') || teamIds.map((id) => data.teams.find((team) => team.id === id)!.name).join(' 和 ');
  const phase = `${season ?? ''} ${seasonType === 'playoffs' ? '季后赛' : '常规赛'}`;
  const perspective = focus === 'defense' ? '防守' : focus === 'offense' ? '进攻' : '';
  const minimum = minimumPossessions === undefined ? '' : `至少 ${minimumPossessions} 回合`;
  let resolvedQuery = query;
  if (intent === 'news' && canContinue && entities) resolvedQuery = `${entities} 新闻 ${query.replace(/他[们的]?|她[们的]?|那|呢|\b(?:his|her|their|news|headlines?)\b/gi, '')}`;
  else if (intent === 'recent') resolvedQuery = `${entities} 最近 ${recentGames} 场 ${phase}`;
  else if (intent === 'comparison') resolvedQuery = `比较 ${entities} ${perspective} ${phase}`;
  else if (intent === 'matchup') resolvedQuery = `${entities} 直接对位 ${query} ${phase} ${minimum}`;
  else if (intent === 'rankings') resolvedQuery = `${topic} 排行榜 前 ${resultCount} 名 ${query} ${phase} ${minimum}`;
  else if (intent === 'playtypes') resolvedQuery = `${entities} ${perspective} 打法 ${phase}`;
  else if (intent === 'team') resolvedQuery = `${entities} 球队 ${query} ${phase}`;
  else if (intent === 'player' && entities) resolvedQuery = `${entities} ${query} ${phase}`;
  return { query, resolvedQuery: resolvedQuery.trim(), context, usedContext: canContinue };
}

export function getScoutFollowUps(data: Dataset, context: ScoutConversationContext, english: boolean): ScoutFollowUp[] {
  const players = context.playerIds.map((id) => data.players.find((player) => player.id === id)).filter((player) => !!player);
  const teams = context.teamIds.map((id) => data.teams.find((team) => team.id === id)).filter((team) => !!team);
  const suggestions: Array<[string, string, string, string]> = [];
  if (players.length > 1) {
    suggestions.push(['比较防守数据', 'Compare defense', '改看他们的防守数据', 'Compare their defense'], ['查看直接对位', 'Direct matchup', '看他们的直接对位', 'Their direct matchup'], ['比较季后赛表现', 'Playoff comparison', `比较 ${players.map((player) => player.name).join(' 和 ')} 季后赛数据`, `Compare ${players.map((player) => player.name).join(' and ')} in the playoffs`]);
  } else if (players[0]) {
    suggestions.push(['最近 5 场', 'Last 5 games', '他最近5场表现', 'His last 5 games'], ['进攻打法', 'Offensive play types', '看他的进攻打法', 'His offensive play types'], ['相关新闻', 'Player news', '他的最新新闻', 'His latest news']);
  } else if (teams.length) {
    suggestions.push(['查看防守效率', 'Defensive rating', '改看球队防守效率', 'What about their team defensive rating?'], ['查看进攻打法', 'Offensive play types', '改看球队进攻打法', 'What about their team offensive play types?'], ['球队新闻', 'Team news', `${teams[0].name} 最新新闻`, `${teams[0].name} latest news`]);
  } else if (context.intent === 'rankings') {
    suggestions.push(['看看季后赛', 'Playoff leaders', '那季后赛呢', 'What about the playoffs?'], ['助攻榜前 10', 'Top 10 assists', '助攻榜前10', 'Top 10 assists leaders'], ['篮板榜前 10', 'Top 10 rebounds', '篮板榜前10', 'Top 10 rebounds leaders']);
  } else {
    suggestions.push(['得分榜前 10', 'Top 10 scorers', '得分榜前10', 'Top 10 scoring leaders'], ['最新 NBA 新闻', 'NBA news', '最新 NBA 新闻', 'Latest NBA news'], ['对手得分最低前 5', 'Lowest points allowed', '样本对手得分最低前5', 'Top 5 lowest opponent scoring']);
  }
  return suggestions.map(([label, en, query, enQuery]) => ({ label: english ? en : label, query: english ? enQuery : query }));
}
