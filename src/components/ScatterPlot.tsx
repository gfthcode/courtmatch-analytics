import { useState } from 'react';
import './scatter-controls.css';

export type ScatterKey='possessions'|'points'|'fieldGoalAttempts'|'assists'|'turnovers'|'efficiency'|'fieldGoalPercentage'|'threePointPercentage';
export type ScatterRow={id:string;name:string;possessions:number;efficiency:number;points:number;fieldGoalAttempts?:number;fieldGoalPercentage?:number|null;threePointPercentage?:number|null;assists?:number;turnovers?:number;avatarUrl?:string};
const numberLabel=(value:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(value);
const xOptions:{key:ScatterKey;label:string}[]=[{key:'possessions',label:'对位回合'},{key:'points',label:'得分'},{key:'fieldGoalAttempts',label:'投篮出手'},{key:'assists',label:'助攻'},{key:'turnovers',label:'失误'}];
const yOptions:{key:ScatterKey;label:string;unit?:string}[]=[{key:'efficiency',label:'每100回合得分'},{key:'fieldGoalPercentage',label:'投篮命中率',unit:'%'},{key:'threePointPercentage',label:'三分命中率',unit:'%'},{key:'points',label:'得分'},{key:'assists',label:'助攻'},{key:'turnovers',label:'失误'}];
const axisValue=(row:ScatterRow,key:ScatterKey)=>{const value=row[key];return value==null||!Number.isFinite(value)?null:value;};
const axisLabel=(key:ScatterKey)=>[...xOptions,...yOptions].find(option=>option.key===key)?.label??key;
const tickLabel=(value:number,key:ScatterKey)=>`${numberLabel(value)}${yOptions.find(option=>option.key===key)?.unit??''}`;
const niceStep=(span:number)=>{const raw=Math.max(span/4,.01),power=10**Math.floor(Math.log10(raw)),fraction=raw/power;return(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*power;};

export function ScatterPlot({rows,average,onClick,onSelect,selectedIds=[]}:{rows:ScatterRow[];average?:number;onClick?:(id:string)=>void;onSelect?:(ids:string[])=>void;selectedIds?:string[]}){
 const [xKey,setXKey]=useState<ScatterKey>('possessions');const [yKey,setYKey]=useState<ScatterKey>('efficiency');const [highlightMode,setHighlightMode]=useState(false);
 const usable=rows.filter(row=>axisValue(row,xKey)!=null&&axisValue(row,yKey)!=null&&Number.isFinite(row.points));
 if(!usable.length)return <div className="scatter-empty" role="status">当前筛选下没有可绘制的有效对位样本。可切换坐标指标或放宽筛选条件。</div>;
 const xValues=usable.map(row=>axisValue(row,xKey)!);const yValues=usable.map(row=>axisValue(row,yKey)!);
 const xMaxValue=Math.max(0,...xValues),yMaxValue=Math.max(0,...yValues);const xStep=niceStep(Math.max(xMaxValue,1)),yStep=niceStep(Math.max(yMaxValue,1));
 const xMax=Math.ceil(xMaxValue/xStep)*xStep||xStep,yMax=Math.ceil(yMaxValue/yStep)*yStep||yStep;
 const xTicks=Array.from({length:5},(_,index)=>xMax*index/4),yTicks=Array.from({length:5},(_,index)=>yMax-yMax*index/4);
 const pointValues=usable.map(row=>Math.sqrt(Math.max(0,row.points)));const pointMin=Math.min(...pointValues),pointMax=Math.max(...pointValues);
 const sampleMean=yValues.reduce((sum,value)=>sum+value,0)/yValues.length;const baseline=yKey==='efficiency'&&average!=null?average:sampleMean;const averagePosition=Math.max(0,Math.min(100,baseline/yMax*100));
 const selected=new Set(selectedIds);const toggleHighlight=(id:string)=>onSelect?.(selected.has(id)?selectedIds.filter(item=>item!==id):[...selectedIds,id]);
 return <div className="scatter-plot" aria-label={`${axisLabel(xKey)}与${axisLabel(yKey)}散点图`}>
  <div className="scatter-controls">
   <label><span>X 轴</span><select aria-label="横轴指标" value={xKey} onChange={event=>setXKey(event.target.value as ScatterKey)}>{xOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
   <label><span>Y 轴</span><select aria-label="纵轴指标" value={yKey} onChange={event=>setYKey(event.target.value as ScatterKey)}>{yOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
   <button className={`scatter-highlight-toggle${highlightMode?' is-active':''}`} type="button" aria-pressed={highlightMode} onClick={()=>setHighlightMode(value=>!value)}>{highlightMode?'完成高亮':'点选高亮'}</button>
   {selected.size>0&&<button className="scatter-clear-selection" type="button" onClick={()=>onSelect?.([])}>清除 {selected.size} 项</button>}
   <span className="scatter-count">{usable.length} 个对手</span>
  </div>
  <div className="scatter-y-axis"><span className="scatter-axis-title">{axisLabel(yKey)}</span>{yTicks.map((tick,index)=><span key={`${tick}-${index}`} className="scatter-y-tick" style={{top:`${index*25}%`}}>{tickLabel(tick,yKey)}</span>)}</div>
  <div className="scatter-plot-area">
   {yTicks.map((tick,index)=><i key={`grid-y-${index}`} className="scatter-grid-y" style={{top:`${index*25}%`}}/>)}
   {xTicks.map((tick,index)=><i key={`grid-x-${index}`} className="scatter-grid-x" style={{left:`${index*25}%`}}/>)}
   <div className="scatter-average" style={{bottom:`${averagePosition}%`}}><span>{yKey==='efficiency'?'数据集均值':'筛选样本均值'} {tickLabel(baseline,yKey)}</span></div>
   {usable.map(row=>{
    const x=Math.max(0,Math.min(100,axisValue(row,xKey)!/xMax*100));const y=Math.max(0,Math.min(100,axisValue(row,yKey)!/yMax*100));
    const size=pointMax===pointMin?28:22+(Math.sqrt(Math.max(0,row.points))-pointMin)/(pointMax-pointMin)*10;const active=selected.has(row.id);
    const label=`${row.name}；${tickLabel(axisValue(row,xKey)!,xKey)} ${axisLabel(xKey)}；${tickLabel(axisValue(row,yKey)!,yKey)} ${axisLabel(yKey)}；${numberLabel(row.possessions)} 对位回合；${numberLabel(row.points)} 分`;
    return <button key={row.id} type="button" className={`scatter-point${active?' is-selected':''}${selected.size&&!active?' is-muted':''}`} aria-label={label} aria-pressed={active} title={label} onClick={()=>highlightMode?toggleHighlight(row.id):onClick?.(row.id)} style={{left:`${x}%`,bottom:`${y}%`,width:`${size}px`,height:`${size}px`}}>{row.avatarUrl?<img src={row.avatarUrl} alt="" loading="lazy"/>:<span className="scatter-initials">{row.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</span>}<span className="scatter-tooltip"><strong>{row.name}</strong><span>{axisLabel(xKey)} {tickLabel(axisValue(row,xKey)!,xKey)} · {axisLabel(yKey)} {tickLabel(axisValue(row,yKey)!,yKey)}</span><span>{numberLabel(row.possessions)} 回合 · {numberLabel(row.points)} 得分 · FG {row.fieldGoalPercentage==null?'—':`${numberLabel(row.fieldGoalPercentage)}%`}</span><span>{highlightMode?'点击头像高亮或取消':'点击头像进入对位详情'}</span></span></button>;
   })}
  </div>
  <div className="scatter-x-axis">{xTicks.map((tick,index)=><span key={`${tick}-${index}`} style={{left:`${index*25}%`}}>{tickLabel(tick,xKey)}</span>)}</div>
  <div className="scatter-x-title">{axisLabel(xKey)} <span>· 头像大小按对位得分缩放</span></div>
  <p className="scatter-chart-hint">悬停查看对位样本 · 默认点击进入详情；开启“点选高亮”后可联动筛选下方记录</p>
 </div>;
}
