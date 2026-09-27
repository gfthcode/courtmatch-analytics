/* Chart rows intentionally support several native chart shapes. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
export type ChartOption={kind:'scatter'|'bar'|'line'|'compare'|'radar'|'heatmap';rows?:any[];labels?:string[];values?:any[];average?:number;min?:number;name?:string};
type ScatterRow = {id:string;name:string;possessions:number;efficiency:number;points:number};
const numberLabel=(value:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(value);

function ScatterPlot({rows,average,onClick,onSelect}:{rows:ScatterRow[];average?:number;onClick?:(id:string)=>void;onSelect?:(ids:string[])=>void}){
 const usable=rows.filter(row=>Number.isFinite(row.possessions)&&Number.isFinite(row.efficiency)&&Number.isFinite(row.points));
 if(!usable.length)return <div className="scatter-empty" role="status">当前筛选下没有可绘制的有效对位样本</div>;
 const maxPossessions=Math.max(1,...usable.map(row=>row.possessions));
 const xStep=maxPossessions>100?50:maxPossessions>40?20:maxPossessions>20?10:5;
 const xMax=Math.ceil(maxPossessions/xStep)*xStep||xStep;
 const minEfficiency=Math.min(...usable.map(row=>row.efficiency));
 const maxEfficiency=Math.max(...usable.map(row=>row.efficiency));
 const rawSpan=Math.max(5,maxEfficiency-minEfficiency);
 const yStep=rawSpan>40?10:rawSpan>20?5:2;
 const yMin=Math.floor((minEfficiency-yStep)/yStep)*yStep;
 const yMax=Math.ceil((maxEfficiency+yStep)/yStep)*yStep;
 const ySpan=Math.max(yStep,yMax-yMin);
 const yTicks=Array.from({length:5},(_,index)=>yMin+ySpan*(4-index)/4);
 const xTicks=Array.from({length:5},(_,index)=>xMax*index/4);
 const pointMin=Math.min(...usable.map(row=>Math.sqrt(Math.max(0,row.points))));
 const pointMax=Math.max(...usable.map(row=>Math.sqrt(Math.max(0,row.points))));
 const averagePosition=average==null?null:Math.max(0,Math.min(100,(average-yMin)/ySpan*100));
 return <div className="scatter-plot" aria-label="对位回合数与每百回合得分散点图">
  <div className="scatter-y-axis"><span className="scatter-axis-title">每100回合得分</span>{yTicks.map((tick,index)=><span key={`${tick}-${index}`} className="scatter-y-tick" style={{top:`${index*25}%`}}>{tick.toFixed(0)}</span>)}</div>
  <div className="scatter-plot-area">
   {yTicks.map((tick,index)=><i key={`grid-y-${index}`} className="scatter-grid-y" style={{top:`${index*25}%`}}/>)}
   {xTicks.map((tick,index)=><i key={`grid-x-${index}`} className="scatter-grid-x" style={{left:`${index*25}%`}}/>)}
   {averagePosition!==null&&<div className="scatter-average" style={{bottom:`${averagePosition}%`}}><span>数据集平均 {average!.toFixed(1)}</span></div>}
   {usable.map((row,index)=>{
    const jitterX=usable.length>1?((index%3)-1)*0.55:0;
    const x=Math.max(0,Math.min(100,row.possessions/xMax*100+jitterX));
    const y=Math.max(0,Math.min(100,(row.efficiency-yMin)/ySpan*100));
    const size=pointMax===pointMin?12:8+(Math.sqrt(Math.max(0,row.points))-pointMin)/(pointMax-pointMin)*10;
    const label=`${row.name}；${numberLabel(row.possessions)} 对位回合；${row.efficiency.toFixed(1)} 分/100回合；${numberLabel(row.points)} 分`;
    return <button key={row.id} type="button" className="scatter-point" aria-label={label} title={label} onClick={()=>onClick?.(row.id)} onDoubleClick={()=>onSelect?.([row.id])} style={{left:`${x}%`,bottom:`${y}%`,width:`${size}px`,height:`${size}px`}}><span className="scatter-tooltip"><strong>{row.name}</strong><span>{numberLabel(row.possessions)} 回合 · {row.efficiency.toFixed(1)} /100</span><span>{numberLabel(row.points)} 得分</span></span></button>;
   })}
  </div>
  <div className="scatter-x-axis">{xTicks.map((tick,index)=><span key={`${tick}-${index}`} style={{left:`${index*25}%`}}>{numberLabel(tick)}</span>)}</div>
  <div className="scatter-x-title">对位回合数 <span>· 圆点越大，得分越高</span></div>
  <p className="scatter-chart-hint">悬停查看球员与样本数据 · 点击圆点进入对位详情</p>
 </div>;
}

export function Chart({title,description,option,onClick,onSelect,onReady,height=390}:{title:string;description:string;option:ChartOption;onClick?:(id:string)=>void;onSelect?:(ids:string[])=>void;onReady?:()=>void;height?:number}){useEffect(()=>{const timer=window.setTimeout(()=>onReady?.(),80);return()=>window.clearTimeout(timer);},[onReady,option]);const rows=option.rows??[];return <section className={`chart-panel chart-${option.kind}`}><header><h2>{title}</h2><p>{description}</p></header><div className="chart-canvas native-chart" style={{height}} role={option.kind==='scatter'?undefined:'img'} aria-label={`${title}。${description}`}>{option.kind==='scatter'&&<ScatterPlot rows={rows as ScatterRow[]} average={option.average} onClick={onClick} onSelect={onSelect}/ >}{option.kind==='bar'&&<div className="bar-chart">{rows.map(r=><div key={r.id}><span>{r.name}</span><i style={{width:`${Math.max(4,Math.min(100,r.value))}%`}}/><b>{Number(r.value).toFixed(1)}</b></div>)}</div>}{option.kind==='line'&&<div className="line-chart">{rows.map((r,i)=><div key={r.label} style={{height:`${Math.max(8,Math.min(88,r.value??0))}%`,left:`${8+i*(82/Math.max(1,rows.length-1))}%`}}><b>{r.label}</b><span>{r.value?.toFixed(1)??'—'}</span></div>)}</div>}{option.kind==='compare'&&<div className="compare-chart">{(option.values??[]).map((v:any,i:number)=><div key={option.labels?.[i]}><b>{option.labels?.[i]}</b><i style={{height:`${Math.min(100,Number(v[0]??0))}%`}}/><i style={{height:`${Math.min(100,Number(v[1]??0))}%`}}/><small>{v[0]?.toFixed?.(1)??'—'} / {v[1]?.toFixed?.(1)??'—'}</small></div>)}</div>}{option.kind==='radar'&&<div className="radar-chart">{(option.values??[]).map((v:number,i:number)=><div key={option.labels?.[i]}><span>{option.labels?.[i]}</span><i style={{width:`${v}%`}}/><b>{v.toFixed(0)}</b></div>)}</div>}{option.kind==='heatmap'&&<div className="heatmap-chart">{rows.map(r=><div key={r.x} style={{backgroundColor:`hsl(${18+Math.max(0,Math.min(70,100-r.value))*1.2} 72% ${Math.max(26,Math.min(56,r.value/2))}%)`}}><span>{r.x}</span><b>{r.value.toFixed(0)}</b></div>)}</div>}</div></section>}
export function scatterOption(rows:{id:string;name:string;possessions:number;efficiency:number;points:number}[],average:number,min:number):ChartOption{return {kind:'scatter',rows,average,min};}
export function rankingOption(rows:{id:string;name:string;value:number}[]):ChartOption{return {kind:'bar',rows};}
export function lineOption(rows:{label:string;value:number|null}[],name:string):ChartOption{return {kind:'line',rows,name};}
export function compareOption(labels:string[],a:string,b:string,av:string,values:[number|null,number|null,number|null][]):ChartOption{return {kind:'compare',labels,values,name:`${a} / ${b} / ${av}`};}
export function radarOption(labels:string[],values:number[],name:string):ChartOption{return {kind:'radar',labels,values,name};}
export function heatmapOption(rows:{x:string;y:string;value:number}[]):ChartOption{return {kind:'heatmap',rows};}
