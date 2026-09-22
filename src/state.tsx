import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { loadDataset, type LoadedDataset } from './lib/provider';
import { DEMO_DATA } from './lib/data';
import { parseFilters, filtersToSearch } from './lib/filters';
import type { Filters } from './lib/types';
import type { DataStatus } from './lib/providers/contracts';
import { Button } from './components/ui/button';

export const readSetting=(key:string,fallback:string)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
export function saveSetting(key:string,value:string){try{localStorage.setItem(key,value);}catch{/* Restricted storage keeps this session functional. */}}
type Settings={theme:string;setTheme:(v:string)=>void;forceDemo:boolean;setForceDemo:(v:boolean)=>void;simulateError:boolean;setSimulateError:(v:boolean)=>void};
const SettingsContext=createContext<Settings|null>(null);
const DataContext=createContext<LoadedDataset|null>(null);
export function SettingsProvider({children}:{children:ReactNode}){
 const [theme,setThemeState]=useState(readSetting('cm-theme','system'));
 const [forceDemo,setForceDemo]=useState(readSetting('cm-demo','false')==='true');
 const [simulateError,setSimulateError]=useState(false);
 const setTheme=(v:string)=>{saveSetting('cm-theme',v);setThemeState(v);};
 return <SettingsContext.Provider value={{theme,setTheme,forceDemo,setForceDemo:(v)=>{saveSetting('cm-demo',String(v));setForceDemo(v);},simulateError,setSimulateError}}>{children}</SettingsContext.Provider>;
}
export function useSettings(){const value=useContext(SettingsContext);if(!value)throw new Error('Settings context missing');return value;}
export function useData(){const value=useContext(DataContext);if(!value)throw new Error('Dataset context missing');return value.dataset;}
export function useDataStatus():DataStatus{const value=useContext(DataContext);if(!value)throw new Error('Dataset context missing');return value.status;}
export function DataGate({children}:{children:ReactNode}){
 const {forceDemo,setForceDemo,simulateError,setSimulateError}=useSettings();
 const query=useQuery({queryKey:['dataset',forceDemo,simulateError],queryFn:async()=>{if(simulateError)throw new Error('Simulated failure');return forceDemo?{dataset:DEMO_DATA,status:{provider:'mock' as const,state:'demo' as const,lastUpdated:DEMO_DATA.updatedAt,version:'demo-2026.09.22',coverage:'NBA · 3 archived demo seasons · 34 players',isDemo:true,message:'已在设置中选择内置演示数据。'}}:loadDataset();},retry:1,staleTime:300000});
 if(query.isPending)return <div className="loading-state" role="status" aria-label="正在加载数据"><div className="skeleton wide"/><div className="skeleton"/><div className="skeleton chart"/><span>正在整理对位数据…</span></div>;
 if(query.isError)return <section className="empty error" role="alert"><p className="eyebrow">DATA CONNECTION</p><h1>暂时无法读取数据</h1><p>连接失败或数据格式不符合要求。你可以重试，或明确切换到内置演示数据继续探索。</p><div className="actions"><Button onClick={()=>{setSimulateError(false);void query.refetch();}}>重试</Button><Button onClick={()=>{setSimulateError(false);setForceDemo(true);}}>使用演示数据</Button></div></section>;
 const {dataset,status}=query.data;const badge=status.state==='live'?'LIVE DATA':status.state==='recently-updated'?'RECENTLY UPDATED':'DEMO DATA';return <DataContext.Provider value={query.data}><div className="data-strip"><span className="mode-tag">{badge}</span><span>{status.isDemo?'Demo data for product demonstration only. Not official NBA Tracking data.':`来源：${status.provider}`}</span><span>{dataset.seasons.length} 个赛季 / {dataset.players.length} 位球员 / {dataset.matchups.length.toLocaleString()} 条对位记录</span><span>更新 {status.lastUpdated.slice(0,10)} · v{status.version}</span>{status.message&&<span title={status.message}>Fallback active</span>}</div>{children}</DataContext.Provider>;
}
export function useFilters(){const [params,setParams]=useSearchParams();const filters=parseFilters(params);function update(patch:Partial<Filters>,resetPage=true){const next={...filters,...patch,...(resetPage&&!('page' in patch)?{page:1}:{})};const encoded=filtersToSearch(next);for(const k of ['opponent','a','b','teamA','teamB']){const v=params.get(k);if(v)encoded.set(k,v);}setParams(encoded,{replace:true});}return {filters,update,params,setParams};}
