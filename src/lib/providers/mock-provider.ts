import { DEMO_DATA } from '../data';
import type { BasketballDataProvider, DataStatus } from './contracts';
import type { Dataset, Filters, MatchupRecord, Player, Team } from '../types';
import { getHeadToHeadMatchup, getMatchups, getPlayerMatchups, getPlayerById, searchPlayers } from '../api';

export class MockProvider implements BasketballDataProvider {
  constructor(private readonly reason?: string) {}
  async getDataset(): Promise<Dataset> { return DEMO_DATA; }
  async getDataStatus(): Promise<DataStatus> { return { provider:'mock',state:'demo',lastUpdated:DEMO_DATA.updatedAt,version:'demo-2026.09.22',coverage:'NBA · 3 archived demo seasons · 34 players',isDemo:true,message:this.reason }; }
  async getPlayers(filters: Partial<Filters> = {}): Promise<Player[]> { return searchPlayers(DEMO_DATA, filters.search ?? '', filters.team); }
  async getTeams(): Promise<Team[]> { return DEMO_DATA.teams; }
  async getMatchups(filters: Partial<Filters> = {}): Promise<MatchupRecord[]> { return getMatchups(DEMO_DATA, filters); }
  async getPlayerById(id:string):Promise<Player|undefined>{return getPlayerById(DEMO_DATA,id);}
  async searchPlayers(query:string):Promise<Player[]>{return searchPlayers(DEMO_DATA,query);}
  async getPlayerStats(playerId:string,filters:Partial<Filters>={}):Promise<Dataset['playerStats']>{return DEMO_DATA.playerStats.filter(row=>row.playerId===playerId&&(!filters.season||row.season===filters.season)&&(!filters.type||row.seasonType===filters.type));}
  async getPlayerMatchups(playerId:string,filters:Partial<Filters>={}):Promise<MatchupRecord[]>{return getPlayerMatchups(DEMO_DATA,playerId,filters);}
  async getHeadToHead(playerA:string,playerB:string,filters:Partial<Filters>={}):Promise<{a:MatchupRecord[];b:MatchupRecord[]}>{return getHeadToHeadMatchup(DEMO_DATA,playerA,playerB,filters);}
  async getPlayerPlayTypes(playerId:string,filters:Partial<Filters>={}):Promise<Dataset['playtypes']>{return DEMO_DATA.playtypes.filter(row=>row.playerId===playerId&&(!filters.season||row.season===filters.season)&&(!filters.type||row.seasonType===filters.type));}
  async getTeamStats(teamId:string,filters:Partial<Filters>={}):Promise<Dataset['teamStats']>{return DEMO_DATA.teamStats.filter(row=>row.teamId===teamId&&(!filters.season||row.season===filters.season)&&(!filters.type||row.seasonType===filters.type));}
  async getDataManifest():Promise<Dataset['manifest']>{return DEMO_DATA.manifest;}
}
