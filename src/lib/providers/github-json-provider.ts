import { z } from 'zod';
import type { Dataset } from '../types';
import { getHeadToHeadMatchup, getPlayerById, getPlayerMatchups, searchPlayers } from '../api';
import type { BasketballDataProvider, DataStatus } from './contracts';
import { matchupSchema, playerSchema, playerStatsSchema, playtypeSchema, teamSchema, teamStatsSchema } from './schemas';

const manifestSchema=z.object({provider:z.literal('github-json'),status:z.enum(['live','recently-updated','demo']),league:z.literal('NBA'),lastUpdated:z.string(),version:z.string(),coverage:z.string(),players:z.string(),teams:z.string(),matchups:z.string(),playerStats:z.string().optional(),playtypes:z.string().optional(),teamStats:z.string().optional(),playerCount:z.number().nonnegative(),matchupRecordCount:z.number().nonnegative(),playtypeRecordCount:z.number().nonnegative().optional(),isDemo:z.boolean()});
async function json(url:string,signal:AbortSignal){const response=await fetch(url,{headers:{Accept:'application/json'},signal,cache:'no-cache'});if(!response.ok)throw new Error(`数据请求失败 (${response.status})`);return response.json();}
export class GithubJsonProvider implements BasketballDataProvider {
  private manifest?:z.infer<typeof manifestSchema>;private dataset?:Dataset;
  constructor(private readonly baseUrl:string){}
  private url(file:string){return `${this.baseUrl.replace(/\/$/,'')}/${file.replace(/^\//,'')}`;}
  private async loadManifest(){if(this.manifest)return this.manifest;const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),8000);try{this.manifest=manifestSchema.parse(await json(this.url('manifest.json'),controller.signal));return this.manifest;}finally{window.clearTimeout(timeout);}}
  private async load(){if(this.dataset)return;const manifest=await this.loadManifest();const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),8000);try{const [players,teams,matchups,playerStats,playtypes,teamStats]=await Promise.all([json(this.url(manifest.players),controller.signal).then(value=>z.array(playerSchema).parse(value)),json(this.url(manifest.teams),controller.signal).then(value=>z.array(teamSchema).parse(value)),json(this.url(manifest.matchups),controller.signal).then(value=>z.array(matchupSchema).parse(value)),manifest.playerStats?json(this.url(manifest.playerStats),controller.signal).then(value=>z.array(playerStatsSchema).parse(value)):Promise.resolve([]),manifest.playtypes?json(this.url(manifest.playtypes),controller.signal).then(value=>z.array(playtypeSchema).parse(value)):Promise.resolve([]),manifest.teamStats?json(this.url(manifest.teamStats),controller.signal).then(value=>z.array(teamStatsSchema).parse(value)):Promise.resolve([])]);const state=manifest.status==='recently-updated'?'stale':manifest.status;this.dataset={players,teams,matchups,playerStats,playtypes,teamStats,manifest:{provider:manifest.provider,status:state,league:'NBA',season:[...new Set(matchups.map(row=>row.season))].sort().reverse()[0]??'',lastUpdated:manifest.lastUpdated,version:manifest.version,playerCount:manifest.playerCount,matchupRecordCount:manifest.matchupRecordCount,playtypeRecordCount:manifest.playtypeRecordCount??playtypes.length,teamCount:teams.length,isDemo:manifest.isDemo,source:`GitHub JSON · ${this.baseUrl}`},source:`GitHub JSON · ${this.baseUrl}`,updatedAt:manifest.lastUpdated,mode:manifest.isDemo?'demo':'live',seasons:[...new Set(matchups.map(row=>row.season))].sort().reverse()};}finally{window.clearTimeout(timeout);}}
  async getDataset(){await this.load();return this.dataset!;}
  async getDataStatus():Promise<DataStatus>{const m=await this.loadManifest();return {provider:'github-json',state:m.status,lastUpdated:m.lastUpdated,version:m.version,coverage:m.coverage,isDemo:m.isDemo};}
  async getPlayers(){return (await this.getDataset()).players;}
  async getTeams(){return (await this.getDataset()).teams;}
  async getMatchups(){return (await this.getDataset()).matchups;}
  async getPlayerById(id:string){return getPlayerById(await this.getDataset(),id);}
  async searchPlayers(query:string){return searchPlayers(await this.getDataset(),query);}
  async getPlayerStats(){return (await this.getDataset()).playerStats;}
  async getPlayerMatchups(playerId:string,filters={}){return getPlayerMatchups(await this.getDataset(),playerId,filters);}
  async getHeadToHead(playerA:string,playerB:string,filters={}){return getHeadToHeadMatchup(await this.getDataset(),playerA,playerB,filters);}
  async getPlayerPlayTypes(){return (await this.getDataset()).playtypes;}
  async getTeamStats(){return (await this.getDataset()).teamStats;}
  async getDataManifest(){return (await this.getDataset()).manifest;}
}
