import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Shield, Swords, Target, TrendingUp } from 'lucide-react';
import { useData, useFilters } from '../state';
import { getPlayerById, getPlayerPlayTypes } from '../lib/api';
import type { PlayTypeRecord } from '../lib/types';
import { SearchPlayers, Empty, PageHead, PlayerIdentity, number } from '../components/Common';
import { Button } from '../components/ui/button';
import { useLanguage } from '../i18n';
import './playtypes.css';

const labels:Record<string,string>={Isolation:'单打',Transition:'转换进攻',PRBallHandler:'挡拆持球',PRRollman:'挡拆顺下',Postup:'低位',Spotup:'定点投篮',Handoff:'手递手',Cut:'空切',OffScreen:'绕掩护',OffRebound:'进攻篮板',Misc:'其他'};
const englishLabels:Record<string,string>={Isolation:'Isolation',Transition:'Transition',PRBallHandler:'Pick & roll ball handler',PRRollman:'Pick & roll roll man',Postup:'Post-up',Spotup:'Spot-up',Handoff:'Handoff',Cut:'Cut',OffScreen:'Off screen',OffRebound:'Putbacks',Misc:'Miscellaneous'};
type SortKey='possessions'|'efficiency'|'percentile';

export function PlayTypesPage({detail=false}:{detail?:boolean}){
 const data=useData();const navigate=useNavigate();const {playerId}=useParams();const {filters}=useFilters();const {language}=useLanguage();const en=language==='en';
 const [grouping,setGrouping]=useState<'offensive'|'defensive'>('offensive');const [sort,setSort]=useState<SortKey>('possessions');const [minPossessions,setMinPossessions]=useState(0);const [selectedType,setSelectedType]=useState<string|null>(null);
 const label=(row:PlayTypeRecord)=> (en?englishLabels[row.playType]:labels[row.playType])??row.playType;
 const fallbackPlayerId=useMemo(()=>data.playtypes.find(row=>row.season===filters.season&&row.seasonType===filters.type)?.playerId??data.players[0]?.id,[data.players,data.playtypes,filters.season,filters.type]);
 const player=getPlayerById(data,detail&&playerId?playerId:fallbackPlayerId??'');
 const sourceRows=useMemo(()=>player?getPlayerPlayTypes(data,player.id,filters).filter(row=>row.grouping===grouping):[],[data,filters,grouping,player]);
 const rows=useMemo(()=>sourceRows.filter(row=>row.possessions>=minPossessions).sort((a,b)=>{if(sort==='efficiency')return (b.pointsPerPossession??-1)-(a.pointsPerPossession??-1);if(sort==='percentile')return (b.percentile??-1)-(a.percentile??-1);return b.possessions-a.possessions;}),[sourceRows,minPossessions,sort]);
 const occurrence=useMemo(()=>{const counts=new Map<string,number>();for(const row of sourceRows)counts.set(row.playType,(counts.get(row.playType)??0)+1);const seen=new Map<string,number>();const indexes=new Map<PlayTypeRecord,number>();for(const row of sourceRows){const next=(seen.get(row.playType)??0)+1;seen.set(row.playType,next);indexes.set(row,next);}return {counts,indexes};},[sourceRows]);
 const rowKey=(row:PlayTypeRecord)=>`${row.playType}#${occurrence.indexes.get(row)??1}`;const displayType=(row:PlayTypeRecord)=>{const count=occurrence.counts.get(row.playType)??1;return count>1?`${label(row)} · ${en?'record':'记录'} ${occurrence.indexes.get(row)}/${count}`:label(row);};
 const repeatedTypes=[...occurrence.counts.entries()].filter(([,count])=>count>1).length;
 const allUsage=sourceRows.reduce((sum,row)=>sum+row.possessions,0);const visibleUsage=rows.reduce((sum,row)=>sum+row.possessions,0);const activeRow=rows.find(row=>rowKey(row)===selectedType)??rows[0];
 const mostUsed=[...sourceRows].sort((a,b)=>b.possessions-a.possessions)[0];const highestPercentile=[...sourceRows].filter(row=>row.percentile!=null).sort((a,b)=>(b.percentile??-1)-(a.percentile??-1))[0];
 const maxPossessions=Math.max(...rows.map(row=>row.possessions),0.1);
 if(!player)return <Empty title={en?'Player not found':'未找到球员'} message={en?'This provider has no play-type records for the selected player.':'当前数据源没有可展示打法的球员。请从搜索结果选择一位球员。'}/>;
 return <>
  <PageHead eyebrow="PLAY TYPE LAB" title={detail?(en?`${player.name} · Play type profile`:`${player.chineseName} 的打法剖面`):(en?'Play types':'球员打法类型')} description={en?'Explore Synergy play-type frequency and efficiency, with the season and sample context kept visible.':'按 Synergy 打法类别查看使用频率与进攻效率，同时保留赛季、样本与数据来源口径。'}/>
  <section className="playtype-command">
   <div><p>{en?'Find a player':'选择球员'}</p><SearchPlayers label={en?'Name, team or abbreviation':'姓名、球队或简称'} onChoose={choice=>navigate(`/playtypes/${choice.id}?season=${filters.season}&type=${filters.type}`)}/></div>
   <div className="playtype-player"><PlayerIdentity player={player} large/><span>{filters.season} · {filters.type==='regular'?(en?'Regular season':'常规赛'):(en?'Playoffs':'季后赛')} · {data.mode==='live'?'LIVE DATA':'DEMO DATA'}</span></div>
  </section>
  <section className="playtype-switch" aria-label={en?'Play type side':'攻防分组'}>
   <div className="playtype-tabs" role="group" aria-label={en?'Offense and defense':'进攻与防守'}>
    <Button variant={grouping==='offensive'?'default':'secondary'} onClick={()=>{setGrouping('offensive');setSelectedType(null);}}><Swords size={16}/>{en?'Offense':'进攻打法'}</Button>
    <Button variant={grouping==='defensive'?'default':'secondary'} onClick={()=>{setGrouping('defensive');setSelectedType(null);}}><Shield size={16}/>{en?'Defense':'防守打法'}</Button>
   </div>
   <span>{en?`${rows.length} of ${sourceRows.length} provider rows · ${number(visibleUsage)} per-game possessions shown`:`显示 ${rows.length}/${sourceRows.length} 条提供方记录 · 合计 ${number(visibleUsage)} 场均使用回合`}</span>
  </section>

  <section className="playtype-summary" aria-label={en?'Play type summary':'打法数据摘要'}>
   <article><span><LayersIcon/></span><small>{en?'Play types covered':'已覆盖打法'}</small><strong>{occurrence.counts.size}<em>{en?'types':'项'}</em></strong><p>{en?`${sourceRows.length} provider rows available`:`当前数据含 ${sourceRows.length} 条提供方记录`}</p></article>
   <article><span><BarChart3 size={17}/></span><small>{en?'Highest-volume record':'最高频记录'}</small><strong className="summary-name">{mostUsed?displayType(mostUsed):(en?'—':'暂无')}</strong><p>{mostUsed?`${number(mostUsed.possessions)} ${en?'possessions per game':'场均回合'}`:(en?'No play-type data':'暂无打法数据')}</p></article>
   <article><span><Target size={17}/></span><small>{en?'Provider percentile leader':'提供方百分位最高'}</small><strong>{highestPercentile?.percentile==null?'—':`${Math.round(highestPercentile.percentile*100)}%`}</strong><p>{highestPercentile?label(highestPercentile):(en?'Percentile unavailable':'暂无百分位数据')}</p></article>
   <article><span><TrendingUp size={17}/></span><small>{en?'Average record volume':'单条记录平均使用量'}</small><strong>{sourceRows.length?number(allUsage/sourceRows.length):'—'}<em>{en?'poss.':'回合'}</em></strong><p>{en?'Per-game values; repeated rows stay separate':'场均值；重复记录保持分开展示'}</p></article>
  </section>

  {repeatedTypes>0&&<aside className="playtype-data-warning" role="note"><strong>{en?`${repeatedTypes} play types have repeated provider rows`:`发现 ${repeatedTypes} 类重复打法记录`}</strong><span>{en?'The published rows do not retain enough team/segment context to combine these values safely. They remain separate; do not read them as distinct play types or season totals.':'当前发布数据未保留足够的球队/赛段信息，无法安全合并重复项。页面将其标为独立来源记录；不能把重复行当成不同打法，也不能视为赛季累计值。'}</span></aside>}

  <div className="playtype-dashboard">
   <section className="playtype-distribution">
    <header className="playtype-panel-head"><div><p className="eyebrow">{grouping==='offensive'?(en?'OFFENSIVE PROFILE':'进攻打法'): (en?'DEFENSIVE PROFILE':'防守打法')}</p><h2>{en?'Usage & efficiency':'打法使用与效率'}</h2><p>{en?'Bars compare possessions per game within this player. Select a row to inspect the provider metrics.':'条形表示当前球员各打法的场均使用回合；选中一行可查看该项的效率与百分位。'}</p></div>
     <div className="playtype-tools"><label>{en?'Minimum poss.':'最低场均回合'}<select value={minPossessions} onChange={event=>setMinPossessions(Number(event.target.value))}><option value={0}>{en?'Show all':'显示全部'}</option><option value={2}>{en?'≥ 2':'≥ 2 回合'}</option><option value={5}>{en?'≥ 5':'≥ 5 回合'}</option><option value={8}>{en?'≥ 8':'≥ 8 回合'}</option></select></label><label>{en?'Sort by':'排序方式'}<select value={sort} onChange={event=>setSort(event.target.value as SortKey)}><option value="possessions">{en?'Possessions':'场均回合'}</option><option value="efficiency">{en?'Points per possession':'每回合得分'}</option><option value="percentile">{en?'Provider percentile':'提供方百分位'}</option></select></label></div>
    </header>
    {!rows.length?<Empty title={en?'No play types match this filter':'没有符合条件的打法'} message={en?'Lower the minimum possessions or change season and season type.':'降低最低场均回合，或切换赛季与比赛类型。'}/>:<div className="playtype-bars" role="group" aria-label={en?'Play type usage chart':'打法使用量图表'}>{rows.map((row,index)=>{const selected=activeRow===row;const width=Math.max(3,row.possessions/maxPossessions*100);const ppp=row.pointsPerPossession;return <button type="button" aria-pressed={selected} aria-label={`${displayType(row)} · ${number(row.possessions)} ${en?'possessions per game':'场均回合'} · ${number(ppp,2)} ${en?'points per possession':'每回合得分'}`} className={`playtype-bar-row${selected?' is-selected':''}`} key={rowKey(row)} onClick={()=>setSelectedType(rowKey(row))}>
      <span className="playtype-rank">{String(index+1).padStart(2,'0')}</span><span className="playtype-bar-name">{displayType(row)}</span><span className="playtype-bar-track"><i style={{width:`${width}%`}}/><b>{number(row.possessions)}</b></span><span className="playtype-bar-ppp"><small>{grouping==='offensive'?(en?'PTS / POSS':'每回合得分'):(en?'OPP PTS / POSS':'对手每回合得分')}</small><strong>{number(ppp,2)}</strong></span><span className="playtype-bar-percentile"><small>{en?'PCTL':'百分位'}</small><strong>{row.percentile==null?'—':`${Math.round(row.percentile*100)}%`}</strong></span>
     </button>;})}</div>}
    <footer className="playtype-chart-foot"><span><i/> {en?'Possessions per game':'场均使用回合'}</span><span>{en?'Values come from NBA Synergy play-type feed; not season totals.':'数据来自 NBA Synergy 球员打法记录；这里展示场均值，并非赛季累计回合。'}</span></footer>
   </section>

   <aside className="playtype-detail-panel" aria-live="polite">
    <div className="playtype-detail-top"><span>{grouping==='offensive'?<Swords size={17}/>:<Shield size={17}/>}</span><small>{en?'SELECTED PLAY TYPE':'当前打法'}</small></div>
    {activeRow?<><h2>{displayType(activeRow)}</h2><p className="playtype-detail-sub">{player.name} · {filters.season} · {grouping==='offensive'?(en?'Offense':'进攻'):(en?'Defense':'防守')}</p>
      <div className="playtype-detail-metrics"><div><small>{en?'Possessions / game':'场均回合'}</small><strong>{number(activeRow.possessions)}</strong></div><div><small>{grouping==='offensive'?(en?'Points / possession':'每回合得分'):(en?'Opponent points / possession':'对手每回合得分')}</small><strong>{number(activeRow.pointsPerPossession,2)}</strong></div><div><small>{en?'Provider percentile':'提供方百分位'}</small><strong>{activeRow.percentile==null?'—':`${Math.round(activeRow.percentile*100)}%`}</strong></div></div>
      <div className="playtype-detail-bar"><span>{en?'Usage share of shown categories':'占当前显示打法使用量'}</span><strong>{visibleUsage?`${number(activeRow.possessions/visibleUsage*100)}%`:'—'}</strong><i><b style={{width:`${visibleUsage?activeRow.possessions/visibleUsage*100:0}%`}}/></i></div>
      <div className="playtype-detail-note"><span className="playtype-data-chip">{en?'NBA SYNERGY · PER GAME':'NBA SYNERGY · 场均口径'}</span><p>{en?'Provider percentile is relative to its covered comparison set, not an NBA award or official league ranking. Low usage is not evidence of poor ability.':'百分位只表示当前提供方覆盖样本中的相对位置，不等于 NBA 官方排行榜；低使用量也不能直接说明球员能力较弱。'}</p></div>
      <Link className="playtype-detail-link" to={`/players/${player.id}?season=${filters.season}`}>{en?'Open player profile':'查看球员画像'} <ArrowUpRight size={15}/></Link>
     </>:<Empty title={en?'No detail available':'暂无详情'} message={en?'Select another season or player.':'请选择其他赛季或球员。'}/>}
   </aside>
  </div>

  <section className="section playtype-table"><div className="section-title"><div><h2>{grouping==='offensive'?(en?'Offensive play types':'进攻打法明细'):(en?'Defensive play types':'防守打法明细')}</h2><p>{en?'Exact provider rows for the selected player, season and play-type group.':'当前球员、赛季与攻防分组对应的原始提供方指标。'}</p></div><Link className="text-link" to={`/players/${player.id}?season=${filters.season}`}>{en?'Player profile':'球员画像'} <ArrowRight size={16}/></Link></div>
   <div className="table-scroll"><table><thead><tr><th>{en?'Play type / source row':'打法 / 来源记录'}</th><th>{en?'Poss. / game':'场均回合'}</th><th>{en?'Share of shown usage':'显示打法占比'}</th><th>{grouping==='offensive'?(en?'Points / poss.':'每回合得分'):(en?'Opp. points / poss.':'对手每回合得分')}</th><th>{en?'Provider percentile':'提供方百分位'}</th><th>{en?'Data basis':'数据口径'}</th></tr></thead><tbody>{rows.map(row=><tr className={activeRow===row?'is-selected':''} key={rowKey(row)} onClick={()=>setSelectedType(rowKey(row))}><td><strong>{displayType(row)}</strong></td><td>{number(row.possessions)}</td><td>{visibleUsage?`${number(row.possessions/visibleUsage*100)}%`:'—'}</td><td>{number(row.pointsPerPossession,2)}</td><td>{row.percentile==null?'—':`${Math.round(row.percentile*100)}%`}</td><td><span className="playtype-data-chip">{en?'Per game':'场均值'}</span></td></tr>)}</tbody></table></div>{!rows.length&&<Empty title={en?'No play-type data':'暂无打法数据'} message={en?'Change the season, season type or player.':'切换赛季、比赛类型或选择其他球员。'}/>}
  </section>
  <p className="playtype-method-note"><strong>{en?'Data note':'数据说明'}</strong> {en?'NBA Synergy groups possessions into standard play types. Defensive values describe the opponent context in the selected defensive play-type category; they should not be read as a standalone measure of overall defense.':'NBA Synergy 将回合归入标准打法类别。防守分组中的效率对应该类别下的对手进攻结果，不应单独视为球员整体防守能力。'} {en?`Data updated ${data.updatedAt.slice(0,10)}.`:`数据更新于 ${data.updatedAt.slice(0,10)}。`}</p>
  <Link className="playtype-profile-link" to={`/playtypes/${player.id}?season=${filters.season}&type=${filters.type}`}>{en?'Open full Play Type profile':'打开该球员完整打法页面'} <ArrowUpRight size={16}/></Link>
 </>;
}

function LayersIcon(){return <BarChart3 size={17}/>;}
