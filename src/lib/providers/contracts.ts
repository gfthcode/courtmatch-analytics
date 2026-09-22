import type { DataManifest, Dataset, Filters, MatchupRecord, Player, PlayerStats, PlayTypeRecord, Team, TeamStats } from '../types';

export type DataStatus = {
  provider: 'mock' | 'github-json' | 'supabase';
  state: 'live' | 'recently-updated' | 'stale' | 'demo' | 'unavailable';
  lastUpdated: string;
  version: string;
  coverage: string;
  isDemo: boolean;
  message?: string;
};

export interface BasketballDataProvider {
  getDataset(): Promise<Dataset>;
  getDataStatus(): Promise<DataStatus>;
  getPlayers(filters?: Partial<Filters>): Promise<Player[]>;
  getTeams(): Promise<Team[]>;
  getMatchups(filters?: Partial<Filters>): Promise<MatchupRecord[]>;
  getPlayerById(id:string): Promise<Player|undefined>;
  searchPlayers(query:string): Promise<Player[]>;
  getPlayerStats(playerId:string,filters?:Partial<Filters>):Promise<PlayerStats[]>;
  getPlayerMatchups(playerId:string,filters?:Partial<Filters>):Promise<MatchupRecord[]>;
  getHeadToHead(playerA:string,playerB:string,filters?:Partial<Filters>):Promise<{a:MatchupRecord[];b:MatchupRecord[]}>;
  getPlayerPlayTypes(playerId:string,filters?:Partial<Filters>):Promise<PlayTypeRecord[]>;
  getTeamStats(teamId:string,filters?:Partial<Filters>):Promise<TeamStats[]>;
  getDataManifest():Promise<DataManifest>;
}
