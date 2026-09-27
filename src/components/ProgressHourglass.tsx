import { useEffect, useMemo, useState } from 'react';
import { Hourglass } from 'lucide-react';
export type ProgressStage={id:string;label:string;complete:boolean;weight:number};
export function ProgressHourglass({stages,activeLabel}:{stages:ProgressStage[];activeLabel?:string}){
 const target=useMemo(()=>Math.round(stages.reduce((sum,s)=>sum+(s.complete?s.weight:0),0)/Math.max(1,stages.reduce((sum,s)=>sum+s.weight,0))*100),[stages]);
 const [shown,setShown]=useState(0);useEffect(()=>{let frame=0;const start=performance.now();const initial=shown;const tick=(now:number)=>{const t=Math.min(1,(now-start)/420);setShown(Math.round(initial+(target-initial)*(1-(1-t)**3)));if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[target]);
 return <section className="progress-hourglass" aria-live="polite" aria-label={`当前完成进度 ${shown}%`}><div className="hourglass-wrap"><Hourglass size={24}/><i style={{height:`${shown}%`}}/></div><div><span className="eyebrow">ANALYSIS PROGRESS</span><strong>{shown}<small>%</small></strong><p>{activeLabel??(shown===100?'分析已就绪':'正在更新分析视图')}</p></div><ol>{stages.map(s=><li key={s.id} className={s.complete?'complete':''}><span>{s.label}</span><b>{s.complete?'完成':'等待'}</b></li>)}</ol></section>;
}
