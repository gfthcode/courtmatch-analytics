import type { Dataset, MatchupRecord, Player, PlayerStats, PlayType, PlayTypeRecord, Position, Team, TeamStats } from './types';

/** Deliberately frozen demo context. These are not historical rosters or live statistics. */
export const SEASONS = ['2024-25', '2023-24', '2022-23'];
export const DATA_UPDATED_AT = '2026-09-22T00:00:00.000Z';

const teamRows = [
  ['gsw', 'Golden State Warriors', '金州勇士', 'GSW'],
  ['lal', 'Los Angeles Lakers', '洛杉矶湖人', 'LAL'],
  ['bos', 'Boston Celtics', '波士顿凯尔特人', 'BOS'],
  ['den', 'Denver Nuggets', '丹佛掘金', 'DEN'],
  ['mil', 'Milwaukee Bucks', '密尔沃基雄鹿', 'MIL'],
  ['dal', 'Dallas Mavericks', '达拉斯独行侠', 'DAL'],
  ['phx', 'Phoenix Suns', '菲尼克斯太阳', 'PHX'],
  ['okc', 'Oklahoma City Thunder', '俄克拉荷马城雷霆', 'OKC'],
  ['min', 'Minnesota Timberwolves', '明尼苏达森林狼', 'MIN'],
  ['nyk', 'New York Knicks', '纽约尼克斯', 'NYK'],
  ['cle', 'Cleveland Cavaliers', '克利夫兰骑士', 'CLE'],
  ['mia', 'Miami Heat', '迈阿密热火', 'MIA'],
  ['phi', 'Philadelphia 76ers', '费城76人', 'PHI'],
  ['sac', 'Sacramento Kings', '萨克拉门托国王', 'SAC'],
  ['lac', 'Los Angeles Clippers', '洛杉矶快船', 'LAC'],
  ['sas', 'San Antonio Spurs', '圣安东尼奥马刺', 'SAS'],
] as const;

export const DEMO_TEAMS: Team[] = teamRows.map(([id, name, chineseName, abbreviation]) => ({
  id, name, chineseName, abbreviation, logoUrl: '',
}));

type PlayerSeed = [string, string, string, string, string, Position, string, number, string, string[]];
const playerRows: PlayerSeed[] = [
  ['stephen-curry', 'Stephen Curry', '斯蒂芬·库里', 'S. Curry', 'gsw', 'G', '1.88 m', 84, '30', ['curry', 'sc', '库里', '萌神']],
  ['draymond-green', 'Draymond Green', '德雷蒙德·格林', 'D. Green', 'gsw', 'F-C', '1.98 m', 104, '23', ['green', 'dg', '追梦']],
  ['lebron-james', 'LeBron James', '勒布朗·詹姆斯', 'L. James', 'lal', 'F', '2.06 m', 113, '23', ['lebron', 'lbj', '詹姆斯', '老詹']],
  ['anthony-davis', 'Anthony Davis', '安东尼·戴维斯', 'A. Davis', 'lal', 'F-C', '2.08 m', 115, '3', ['davis', 'ad', '浓眉']],
  ['jayson-tatum', 'Jayson Tatum', '杰森·塔图姆', 'J. Tatum', 'bos', 'F', '2.03 m', 95, '0', ['tatum', 'jt', '塔图姆']],
  ['jaylen-brown', 'Jaylen Brown', '杰伦·布朗', 'J. Brown', 'bos', 'G-F', '1.98 m', 101, '7', ['brown', 'jb', '布朗']],
  ['jrue-holiday', 'Jrue Holiday', '朱·霍勒迪', 'J. Holiday', 'bos', 'G', '1.93 m', 93, '4', ['holiday', '霍勒迪']],
  ['nikola-jokic', 'Nikola Jokic', '尼古拉·约基奇', 'N. Jokic', 'den', 'C', '2.11 m', 129, '15', ['jokic', 'joker', '约基奇', '约老师']],
  ['jamal-murray', 'Jamal Murray', '贾马尔·穆雷', 'J. Murray', 'den', 'G', '1.93 m', 98, '27', ['murray', '穆雷']],
  ['aaron-gordon', 'Aaron Gordon', '阿隆·戈登', 'A. Gordon', 'den', 'F', '2.03 m', 107, '50', ['gordon', '戈登']],
  ['giannis-antetokounmpo', 'Giannis Antetokounmpo', '扬尼斯·阿德托昆博', 'G. Antetokounmpo', 'mil', 'F', '2.11 m', 110, '34', ['giannis', '字母哥']],
  ['damian-lillard', 'Damian Lillard', '达米安·利拉德', 'D. Lillard', 'mil', 'G', '1.88 m', 88, '0', ['lillard', 'dame', '利拉德']],
  ['luka-doncic', 'Luka Doncic', '卢卡·东契奇', 'L. Doncic', 'dal', 'G-F', '2.01 m', 104, '77', ['doncic', 'luka', '东契奇']],
  ['kyrie-irving', 'Kyrie Irving', '凯里·欧文', 'K. Irving', 'dal', 'G', '1.88 m', 88, '11', ['irving', 'kyrie', '欧文']],
  ['kevin-durant', 'Kevin Durant', '凯文·杜兰特', 'K. Durant', 'phx', 'F', '2.11 m', 109, '35', ['durant', 'kd', '杜兰特']],
  ['devin-booker', 'Devin Booker', '德文·布克', 'D. Booker', 'phx', 'G', '1.98 m', 93, '1', ['booker', '布克']],
  ['shai-gilgeous-alexander', 'Shai Gilgeous-Alexander', '谢伊·吉尔杰斯-亚历山大', 'S. Gilgeous-Alexander', 'okc', 'G', '1.98 m', 88, '2', ['shai', 'sga', '亚历山大']],
  ['jalen-williams', 'Jalen Williams', '杰伦·威廉姆斯', 'J. Williams', 'okc', 'G-F', '1.96 m', 96, '8', ['jdub', '杰伦威廉姆斯']],
  ['chet-holmgren', 'Chet Holmgren', '切特·霍姆格伦', 'C. Holmgren', 'okc', 'C', '2.16 m', 94, '7', ['chet', '霍姆格伦']],
  ['anthony-edwards', 'Anthony Edwards', '安东尼·爱德华兹', 'A. Edwards', 'min', 'G', '1.93 m', 102, '5', ['edwards', 'ant', '爱德华兹', '华子']],
  ['rudy-gobert', 'Rudy Gobert', '鲁迪·戈贝尔', 'R. Gobert', 'min', 'C', '2.16 m', 117, '27', ['gobert', '戈贝尔']],
  ['jalen-brunson', 'Jalen Brunson', '杰伦·布伦森', 'J. Brunson', 'nyk', 'G', '1.88 m', 86, '11', ['brunson', '布伦森']],
  ['og-anunoby', 'OG Anunoby', 'OG·阿努诺比', 'O. Anunoby', 'nyk', 'F', '2.01 m', 109, '8', ['og', '阿努诺比']],
  ['donovan-mitchell', 'Donovan Mitchell', '多诺万·米切尔', 'D. Mitchell', 'cle', 'G', '1.91 m', 98, '45', ['mitchell', 'spida', '米切尔']],
  ['evan-mobley', 'Evan Mobley', '埃文·莫布里', 'E. Mobley', 'cle', 'F-C', '2.11 m', 98, '4', ['mobley', '莫布里']],
  ['jimmy-butler', 'Jimmy Butler', '吉米·巴特勒', 'J. Butler', 'mia', 'F', '2.01 m', 104, '22', ['butler', '巴特勒']],
  ['bam-adebayo', 'Bam Adebayo', '巴姆·阿德巴约', 'B. Adebayo', 'mia', 'C', '2.06 m', 116, '13', ['bam', '阿德巴约']],
  ['joel-embiid', 'Joel Embiid', '乔尔·恩比德', 'J. Embiid', 'phi', 'C', '2.13 m', 127, '21', ['embiid', '恩比德']],
  ['tyrese-maxey', 'Tyrese Maxey', '泰雷斯·马克西', 'T. Maxey', 'phi', 'G', '1.88 m', 91, '0', ['maxey', '马克西']],
  ['deaaron-fox', "De'Aaron Fox", '达龙·福克斯', 'D. Fox', 'sac', 'G', '1.91 m', 84, '5', ['fox', '福克斯']],
  ['domantas-sabonis', 'Domantas Sabonis', '多曼塔斯·萨博尼斯', 'D. Sabonis', 'sac', 'C', '2.08 m', 109, '10', ['sabonis', '萨博尼斯']],
  ['kawhi-leonard', 'Kawhi Leonard', '科怀·伦纳德', 'K. Leonard', 'lac', 'F', '2.01 m', 102, '2', ['kawhi', '伦纳德', '小卡']],
  ['james-harden', 'James Harden', '詹姆斯·哈登', 'J. Harden', 'lac', 'G', '1.96 m', 100, '1', ['harden', '哈登']],
  ['victor-wembanyama', 'Victor Wembanyama', '维克托·文班亚马', 'V. Wembanyama', 'sas', 'C', '2.24 m', 107, '1', ['wemby', 'wembanyama', '文班亚马']],
];

export const DEMO_PLAYERS: Player[] = playerRows.map(([id, name, chineseName, shortName, teamId, position, height, weight, jerseyNumber, aliases]) => {
  const team = DEMO_TEAMS.find((item) => item.id === teamId)!;
  return { id, name, chineseName, aliases, shortName, teamId, teamName: team.name, teamAbbreviation: team.abbreviation, position, height, weight, jerseyNumber, headshotUrl: '', league: 'NBA' };
});

function hash(text: string): number {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

function syntheticMatchup(offense: Player, defense: Player, season: string, seasonType: 'regular' | 'playoffs'): MatchupRecord {
  const key = `${offense.id}:${defense.id}:${season}:${seasonType}`;
  const seed = hash(key);
  const possessions = seed % 97 === 0 ? 0 : (seasonType === 'regular' ? 8 + seed % 145 : 4 + seed % 107);
  const fieldGoalAttempts = Math.floor(possessions * (0.7 + (seed % 17) / 100));
  const threePointAttempts = Math.floor(fieldGoalAttempts * (offense.position === 'C' ? 0.1 : 0.37 + (seed % 16) / 100));
  const twoPointAttempts = fieldGoalAttempts - threePointAttempts;
  const twoPointMade = Math.round(twoPointAttempts * (0.37 + ((seed >>> 5) % 32) / 100));
  const threePointMade = Math.round(threePointAttempts * (0.23 + ((seed >>> 10) % 24) / 100));
  const freeThrowAttempts = Math.floor(possessions * (0.1 + ((seed >>> 12) % 21) / 100));
  const freeThrowsMade = Math.round(freeThrowAttempts * (0.62 + ((seed >>> 15) % 31) / 100));
  return {
    id: `demo-${key}`, offensivePlayerId: offense.id, defensivePlayerId: defense.id,
    season, seasonType, league: 'NBA', matchupPossessions: possessions,
    points: 2 * twoPointMade + 3 * threePointMade + freeThrowsMade,
    fieldGoalAttempts, fieldGoalsMade: twoPointMade + threePointMade, threePointAttempts, threePointMade,
    freeThrowAttempts, freeThrowsMade, turnovers: Math.floor(possessions * (0.05 + ((seed >>> 18) % 12) / 100)),
    assists: seed % 7 === 0 ? undefined : Math.floor(possessions * 0.12),
    rebounds: seed % 11 === 0 ? undefined : Math.floor(possessions * 0.08),
    updatedAt: DATA_UPDATED_AT,
  };
}

export const DEMO_MATCHUPS: MatchupRecord[] = DEMO_PLAYERS.flatMap((offense) =>
  DEMO_PLAYERS.filter((defense) => offense.teamId !== defense.teamId).flatMap((defense) =>
    SEASONS.flatMap((season) => (['regular', 'playoffs'] as const)
      // Intentionally absent combinations exercise honest empty results in the UI.
      .filter((type) => !(type === 'playoffs' && hash(`${offense.id}:${defense.id}:${season}`) % 4 === 0))
      .map((type) => syntheticMatchup(offense, defense, season, type)))));

const playTypes:PlayType[]=['Isolation','Transition','PRBallHandler','PRRollman','Postup','Spotup','Handoff','Cut','OffScreen','OffRebound','Misc'];
export const DEMO_PLAYER_STATS:PlayerStats[]=DEMO_PLAYERS.flatMap(player=>SEASONS.flatMap((season,index)=>(['regular','playoffs'] as const).map(seasonType=>{const seed=hash(`${player.id}:${season}:${seasonType}:stats`);return {playerId:player.id,season,seasonType,gamesPlayed:seasonType==='regular'?62+seed%20:4+seed%13,pointsPerGame:Math.round((14+(seed%180)/10-index*.6)*10)/10,reboundsPerGame:Math.round((3+(seed>>>4)%100/10)*10)/10,assistsPerGame:Math.round((2+(seed>>>8)%90/10)*10)/10,stealsPerGame:Math.round((.4+(seed>>>12)%20/10)*10)/10,blocksPerGame:Math.round((.2+(seed>>>15)%26/10)*10)/10,fieldGoalPercentage:Math.round((41+(seed>>>18)%160/10)*10)/10,threePointPercentage:Math.round((28+(seed>>>21)%150/10)*10)/10,freeThrowPercentage:Math.round((68+(seed>>>24)%210/10)*10)/10,trueShootingPercentage:Math.round((51+(seed>>>27)%120/10)*10)/10,updatedAt:DATA_UPDATED_AT};})));
export const DEMO_PLAYTYPES:PlayTypeRecord[]=DEMO_PLAYERS.flatMap(player=>SEASONS.flatMap(season=>(['regular','playoffs'] as const).flatMap(seasonType=>playTypes.flatMap(playType=>(['offensive','defensive'] as const).map(grouping=>{const seed=hash(`${player.id}:${season}:${seasonType}:${playType}:${grouping}`);return {playerId:player.id,playType,grouping,season,seasonType,possessions:12+seed%210,pointsPerPossession:Math.round((.68+(seed>>>6)%85/100)*100)/100,percentile:Math.min(99,Math.max(1,seed%100)),updatedAt:DATA_UPDATED_AT};})))));
export const DEMO_TEAM_STATS:TeamStats[]=DEMO_TEAMS.flatMap(team=>SEASONS.map(season=>{const seed=hash(`${team.id}:${season}:team`);return {teamId:team.id,season,seasonType:'regular' as const,wins:28+seed%32,losses:82-(28+seed%32),offensiveRating:Math.round((106+(seed>>>6)%130/10)*10)/10,defensiveRating:Math.round((105+(seed>>>13)%120/10)*10)/10,pace:Math.round((95+(seed>>>21)%70/10)*10)/10,updatedAt:DATA_UPDATED_AT};}));

export const DEMO_DATA: Dataset = {
  players: DEMO_PLAYERS, teams: DEMO_TEAMS, matchups: DEMO_MATCHUPS, playerStats:DEMO_PLAYER_STATS, playtypes:DEMO_PLAYTYPES, teamStats:DEMO_TEAM_STATS, seasons: SEASONS,
  manifest:{provider:'mock',status:'demo',league:'NBA',season:SEASONS[0],lastUpdated:DATA_UPDATED_AT,version:'demo-2026.09.22',playerCount:DEMO_PLAYERS.length,matchupRecordCount:DEMO_MATCHUPS.length,playtypeRecordCount:DEMO_PLAYTYPES.length,teamCount:DEMO_TEAMS.length,isDemo:true,source:'CourtMatch deterministic synthetic dataset'},
  source: 'CourtMatch deterministic synthetic dataset · not official NBA Tracking data',
  updatedAt: DATA_UPDATED_AT, mode: 'demo',
};
