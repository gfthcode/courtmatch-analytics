import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search, X } from 'lucide-react';
import { useData } from '../state';
import { useLanguage } from '../i18n';
import { DataMethodNote, Empty, PageHead, Pagination, PlayerLink, number } from '../components/Common';
import type { Player, PlayerStats } from '../lib/types';
import './nba-stats.css';

const categories = ['perGame', 'per36', 'efficiency'] as const;
type Category = typeof categories[number];
type PlayerColumn = { label: string; value: (row: PlayerStats) => number | null; percent?: boolean; lowerIsBetter?: boolean };

function PlayerStatDistribution({ column, rows, selectedPlayerId, onClose, en }: {
  column: PlayerColumn;
  rows: { stat: PlayerStats; player: Player }[];
  selectedPlayerId: string | null;
  onClose: () => void;
  en: boolean;
}) {
  const points = rows.map(({ stat, player }) => ({ player, value: column.value(stat) })).filter((item): item is { player: Player; value: number } => item.value != null);
  const values = points.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const range = max - min || 1;
  const stacks = new Map<number, number>();
  const dots = points.map((point) => {
    const bin = Math.round(((point.value - min) / range) * 92);
    const stack = stacks.get(bin) ?? 0;
    stacks.set(bin, stack + 1);
    return { ...point, left: Math.max(1, Math.min(99, (bin / 92) * 100)), bottom: 7 + stack * 6 };
  });
  const sorted = values.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;

  return <aside className="player-stat-distribution" aria-label={en ? `${column.label} distribution` : `${column.label} 分布`}>
    <header><div><span>{en ? 'LEAGUE DISTRIBUTION' : '联盟分布'}</span><h3>{column.label}</h3></div><button type="button" onClick={onClose} aria-label={en ? 'Close distribution' : '关闭分布图'}><X size={18}/></button></header>
    <p>{en ? 'Each dot is a player in the current filters.' : '每个圆点代表当前筛选范围内的一名球员。'}</p>
    <div className="player-stat-swarm" role="img" aria-label={en ? `${points.length} players; range ${number(min)} to ${number(max)}; median ${number(median)}` : `${points.length} 位球员；区间 ${number(min)} 至 ${number(max)}；中位数 ${number(median)}`}>
      {dots.map(({ player, value, left, bottom }) => <i key={player.id} className={player.id === selectedPlayerId ? 'is-selected' : ''} style={{ left: `${left}%`, bottom: `${bottom}px` }} title={`${player.name}: ${number(value)}${column.percent ? '%' : ''}`} />)}
    </div>
    <div className="player-stat-swarm-axis"><span>{number(min)}</span><span>{en ? `Median ${number(median)}` : `中位数 ${number(median)}`}</span><span>{number(max)}</span></div>
    <small>{en ? `${points.length} players · current season and filters` : `${points.length} 位球员 · 当前赛季与筛选条件`}</small>
  </aside>;
}

export function NBAPlayerStatsPage() {
  const data = useData();
  const { language } = useLanguage();
  const en = language === 'en';
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [distributionColumn, setDistributionColumn] = useState<PlayerColumn | null>(null);
  const [distributionOpen, setDistributionOpen] = useState(false);
  const [distributionDismissed, setDistributionDismissed] = useState(false);
  const [params, setParams] = useSearchParams();
  const season = params.get('season') ?? data.seasons[0] ?? '2025-26';
  const type = params.get('type') === 'playoffs' ? 'playoffs' : 'regular';
  const category: Category = categories.includes(params.get('category') as Category) ? params.get('category') as Category : 'perGame';
  const query = params.get('q') ?? '';
  const team = params.get('team') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const minMinutes = Math.max(0, Number(params.get('minMinutes') ?? '500'));
  const direction = params.get('order') === 'asc' ? -1 : 1;
  const sort = params.get('sort') ?? (category === 'per36' ? 'PTS/36' : category === 'efficiency' ? 'TS%' : 'PTS');
  const set = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); next.delete('page'); if (key === 'category') { next.delete('sort'); next.delete('order'); } setParams(next, { replace: true }); };
  const columns = useMemo<PlayerColumn[]>(() => {
    const stat = (key: keyof PlayerStats) => (row: PlayerStats) => typeof row[key] === 'number' ? row[key] as number : null;
    const rate = (label: string, key: keyof typeof data.playerStats[number]) => ({ label, value: stat(key), percent: true });
    const ordinary = (label: string, key: keyof PlayerStats, lowerIsBetter = false) => ({ label, value: stat(key), percent: false, lowerIsBetter });
    if (category === 'per36') return (['pointsPerGame','reboundsPerGame','assistsPerGame','stealsPerGame','blocksPerGame'] as const).map((key,index)=>({label:['PTS/36','REB/36','AST/36','STL/36','BLK/36'][index],value:(row:PlayerStats)=>row.minutesPerGame?row[key]*36/row.minutesPerGame:null,percent:false}));
    if (category === 'efficiency') return [rate('FG%', 'fieldGoalPercentage'), rate('3P%', 'threePointPercentage'), rate('FT%', 'freeThrowPercentage'), rate('eFG%', 'effectiveFieldGoalPercentage'), rate('TS%', 'trueShootingPercentage'), rate('USG%', 'usagePercentage'), ordinary('ORtg', 'offensiveRating'), ordinary('DRtg', 'defensiveRating', true)];
    return [ordinary('MIN','minutesPerGame'),ordinary('PTS','pointsPerGame'),ordinary('AST','assistsPerGame'),ordinary('OREB','offensiveReboundsPerGame'),ordinary('DREB','defensiveReboundsPerGame'),ordinary('STL','stealsPerGame'),ordinary('BLK','blocksPerGame'),ordinary('TOV','turnoversPerGame',true),ordinary('PF','personalFoulsPerGame',true),ordinary('FGM','fieldGoalsMadePerGame'),ordinary('FGA','fieldGoalsAttemptedPerGame'),rate('FG%','fieldGoalPercentage'),ordinary('3PM','threePointersMadePerGame'),ordinary('3PA','threePointersAttemptedPerGame'),rate('3P%','threePointPercentage'),ordinary('FTM','freeThrowsMadePerGame'),ordinary('FTA','freeThrowsAttemptedPerGame'),rate('FT%','freeThrowPercentage'),ordinary('+/-','plusMinusPerGame')];
  }, [category, data.playerStats]);
  const activeSort = columns.find(column => column.label === sort) ?? columns[0];
  const players = new Map(data.players.map(player => [player.id, player]));
  const rows = data.playerStats.filter(stat => stat.season === season && stat.seasonType === type && stat.gamesPlayed > 0 && (stat.minutesPerGame ?? 0) * stat.gamesPlayed >= minMinutes).map(stat => ({ stat, player: players.get(stat.playerId) })).filter((row): row is {stat:typeof data.playerStats[number];player:typeof data.players[number]} => !!row.player && (!team || row.player.teamId === team) && (!query || [row.player.name,row.player.chineseName,row.player.teamAbbreviation].some(value=>value.toLowerCase().includes(query.toLowerCase())))).sort((a,b)=>{const av=activeSort.value(a.stat),bv=activeSort.value(b.stat);if(av==null)return bv==null?0:1;if(bv==null)return -1;return (bv-av)*direction;});
  const rowsPage = rows.slice((page-1)*25,page*25);
  const exportCsv = () => {
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = [en?'Player':'球员',en?'Team':'球队',en?'Position':'位置',en?'Season':'赛季',en?'Season type':'赛段',...columns.map(column=>column.label)];
    const body = rows.map(({stat,player})=>[player.name,player.teamAbbreviation,player.position,stat.season,stat.seasonType,...columns.map(column=>{const value=column.value(stat);return value==null?'':column.percent?(value*100).toFixed(1):value.toFixed(1);})]);
    const csv = `\uFEFF${[header,...body].map(line=>line.map(quote).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download=`nba-player-stats-${season}-${type}.csv`; anchor.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const sortBy = (column: PlayerColumn) => {
    const next=params.get('sort')===column.label&&params.get('order')!=='asc'?'asc':'desc';
    const p=new URLSearchParams(params);p.set('sort',column.label);p.set('order',next);p.delete('page');setParams(p,{replace:true});
    setDistributionColumn(column);if(!distributionDismissed)setDistributionOpen(true);
  };
  const distributionCache = new Map<string, number[]>();
  const toneFor = (column: PlayerColumn, value: number | null) => {
    if (value == null || rows.length < 4) return 'neutral';
    const available=distributionCache.get(column.label)??rows.map(row=>column.value(row.stat)).filter((item):item is number=>item!=null).sort((a,b)=>a-b);
    distributionCache.set(column.label,available);
    const rank=available.filter(item=>item<value).length/Math.max(1,available.length-1);
    const relative=column.lowerIsBetter?1-rank:rank;
    return relative>=.72?'high':relative<=.28?'low':'mid';
  };
  const toggleSelection = (playerId: string) => setSelectedPlayerId(current=>current===playerId?null:playerId);
  const selectedPlayer=selectedPlayerId?data.players.find(player=>player.id===selectedPlayerId):undefined;
  const showDistribution=distributionOpen&&!distributionDismissed&&distributionColumn!=null;
  const tableRows=rowsPage.map(({stat,player},index)=><tr key={stat.playerId+'-'+stat.seasonType} className={selectedPlayerId===player.id?'is-selected':''} aria-selected={selectedPlayerId===player.id} tabIndex={0} onClick={event=>{if((event.target as HTMLElement).closest('a,button'))return;toggleSelection(player.id);}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleSelection(player.id);}}}>
    <td>{(page-1)*25+index+1}</td><td><PlayerLink player={player}/></td><td>{player.teamAbbreviation}</td><td>{player.position==='Unknown'&&!en?'未核验':player.position}</td>
    {columns.map(column=>{const value=column.value(stat);return <td key={column.label}><span className={`player-stat-value tone-${toneFor(column,value)}`}>{value==null?'—':column.percent?`${(value*100).toFixed(1)}%`:value.toFixed(1)}</span></td>;})}
  </tr>);
  return <div className="player-stats-page"><PageHead eyebrow="NBA STATS · OFFICIAL" title={en?'NBA Player Stats':'NBA 球员统计榜'} description={en?'Official NBA Stats season leaders, sortable distribution, row selection and filtered CSV export.':'NBA Stats 官方赛季统计：支持场均、每36分钟和效率榜，并可排序、查看分布、选择球员与下载筛选结果。'} />
    <section className="directory-toolbar player-stats-toolbar"><label className="field"><span>{en?'Season':'赛季'}</span><select value={season} onChange={e=>set('season',e.target.value)}>{data.seasons.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>{en?'Season type':'赛段'}</span><select value={type} onChange={e=>set('type',e.target.value)}><option value="regular">{en?'Regular season':'常规赛'}</option><option value="playoffs">{en?'Playoffs':'季后赛'}</option></select></label><label className="field"><span>{en?'Category':'统计口径'}</span><select value={category} onChange={e=>set('category',e.target.value)}><option value="perGame">{en?'Per game':'场均'}</option><option value="per36">{en?'Per 36 minutes':'每36分钟'}</option><option value="efficiency">{en?'Efficiency':'效率'}</option></select></label><label className="field"><span>{en?'Team':'球队'}</span><select value={team} onChange={e=>set('team',e.target.value)}><option value="">{en?'All teams':'全部球队'}</option>{data.teams.map(value=><option key={value.id} value={value.id}>{value.abbreviation}</option>)}</select></label><label className="field"><span><Search size={14}/>{en?'Search':'搜索球员'}</span><input value={query} onChange={e=>set('q',e.target.value)} placeholder={en?'Player / team':'姓名或球队'} /></label><label className="field"><span>{en?'Minimum season minutes':'最低赛季分钟'}</span><input type="number" min="0" value={minMinutes} onChange={e=>set('minMinutes',e.target.value)} /></label></section>
    <section className="section table-section player-stats-section"><header className="player-stats-section-head"><div><h2>{en?`${season} Player Stats`:`NBA ${season} 赛季球员数据表`}</h2><p>{en?'Click a stat heading to sort and view its distribution. Select a row; select again to clear.':'点击数值列排序并切换分布指标；点击表格行选中球员，再次点击取消。'}</p><small>{rows.length} {en?'players':'位球员'} · NBA Stats API · {data.manifest.playerStatsSourceUpdatedAt?.slice(0,10)??data.updatedAt.slice(0,10)} · {data.manifest.status==='live'?'LIVE':en?'verified cache / stale':'已验证缓存 / 数据陈旧'}</small><small>{en?'Color indicates relative rank within current filters, not an overall grade.':'颜色仅表示当前筛选范围内的相对分位，不代表综合评分。'}</small></div><button className="player-stats-download" type="button" onClick={exportCsv}><Download size={16}/>{en?'Download CSV':'下载数据'}</button></header>
      {selectedPlayer&&<div className="player-selection-note" role="status"><span>{en?'Selected':'已选球员'}：<PlayerLink player={selectedPlayer}/></span><button type="button" onClick={()=>setSelectedPlayerId(null)}>{en?'Clear':'取消选择'} <X size={14}/></button></div>}
      <div className={`player-stats-results${showDistribution?' has-distribution':''}`}>
        <div className="table-scroll player-stats-table-scroll"><table className="player-stats-table"><thead><tr><th>{en?'Rank':'排名'}</th><th>{en?'Player':'球员'}</th><th>{en?'Team':'球队'}</th><th>{en?'Position':'位置'}</th>{columns.map(column=><th key={column.label}><button className={`text-button${sort===column.label?' is-current':''}`} aria-pressed={sort===column.label} onClick={()=>sortBy(column)}>{column.label}{sort===column.label?(direction===-1?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{tableRows}</tbody></table></div>
        {showDistribution&&distributionColumn&&<PlayerStatDistribution column={distributionColumn} rows={rows} selectedPlayerId={selectedPlayerId} en={en} onClose={()=>{setDistributionOpen(false);setDistributionDismissed(true);}}/>}
      </div>
      {!rows.length&&<Empty title={en?'No players match':'没有匹配球员'} message={en?'Try a lower minute threshold or clear filters.':'调低出场分钟门槛或清除筛选。'}/>}<Pagination page={page} total={rows.length} pageSize={25} onChange={next=>set('page',String(next))}/>
    </section><DataMethodNote />
  </div>;
}

export function NBADailyPage() {
  const data = useData(); const { language } = useLanguage(); const en = language==='en'; const [params,setParams]=useSearchParams();
  const all = data.daily ?? []; const type=params.get('type')==='playoffs'?'playoffs':'regular';
  const seasons=[...new Set(all.map(row=>row.season))].sort((a,b)=>b.localeCompare(a));
  const requestedSeason=params.get('season')??seasons[0]??''; const season=seasons.includes(requestedSeason)?requestedSeason:seasons[0]??'';
  const dates=[...new Set(all.filter(row=>row.season===season&&row.seasonType===type).map(row=>row.date))].sort((a,b)=>b.localeCompare(a));
  const requestedDate=params.get('date')??''; const date=dates.includes(requestedDate)?requestedDate:dates[0]??'';
  const query=params.get('q')??''; const team=params.get('team')??'';
  const requestedPage=Number(params.get('page')??'1'); const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1;
  const teams=new Map(data.teams.map(team=>[team.id,team])); const players=new Map(data.players.map(player=>[player.id,player]));
  const filteredLogs=all.filter(row=>row.season===season&&row.seasonType===type&&row.date===date&&(!team||row.teamId===team)&&(!query||[players.get(row.playerId)?.name??'',players.get(row.playerId)?.chineseName??'',players.get(row.playerId)?.shortName??'',row.teamAbbreviation,row.opponent].some(value=>value.toLowerCase().includes(query.toLowerCase())))).sort((a,b)=>b.points-a.points);
  const pageSize=50; const pageCount=Math.max(1,Math.ceil(filteredLogs.length/pageSize)); const currentPage=Math.min(page,pageCount); const logs=filteredLogs.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const set=(key:string,value:string)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);next.delete('page');if(key==='type'||key==='season')next.delete('date');setParams(next,{replace:true});};
  return <><PageHead eyebrow="NBA GAME LOGS · OFFICIAL" title={en?'Daily NBA Box Scores':'每日 NBA 球员数据'} description={en?'Official player box scores by game date, including regular season and playoffs.':'按比赛日期浏览 NBA Stats 官方球员逐场数据，含常规赛与季后赛。'} />
    <section className="directory-toolbar"><label className="field"><span>{en?'Season':'赛季'}</span><select value={season} onChange={e=>set('season',e.target.value)}>{seasons.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>{en?'Season type':'赛段'}</span><select value={type} onChange={e=>set('type',e.target.value)}><option value="regular">{en?'Regular season':'常规赛'}</option><option value="playoffs">{en?'Playoffs':'季后赛'}</option></select></label><label className="field"><span>{en?'Date':'比赛日期'}</span><select value={date} onChange={e=>set('date',e.target.value)}>{dates.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>{en?'Team':'球队'}</span><select value={team} onChange={e=>set('team',e.target.value)}><option value="">{en?'All teams':'全部球队'}</option>{data.teams.map(value=><option key={value.id} value={value.id}>{value.abbreviation}</option>)}</select></label><label className="field"><span><Search size={14}/>{en?'Player / team':'球员或球队'}</span><input value={query} onChange={e=>set('q',e.target.value)} /></label></section>
    <section className="daily-grid">{filteredLogs.slice(0,5).map(row=>{const player=players.get(row.playerId);return player?<article className="directory-card" key={row.id}><PlayerLink player={player}/><strong>{number(row.points,0)} <small>PTS</small></strong><p>{row.teamAbbreviation} · {row.matchup} · {row.result}</p></article>:null})}</section>
    <section className="section table-section"><div className="section-title"><div><h2>{date|| (en?'No game logs available':'暂无逐场数据')}</h2><p>{filteredLogs.length} {en?'player box scores':'条球员比赛记录'} · NBA Stats API · {season} · {type==='regular'?(en?'Regular season':'常规赛'):(en?'Playoffs':'季后赛')}</p></div><small>{data.manifest.dailySourceUpdatedAt?.slice(0,10)??data.updatedAt.slice(0,10)}</small></div>
    <div className="table-scroll"><table><thead><tr><th>{en?'Player':'球员'}</th><th>{en?'Matchup':'比赛'}</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>FG</th><th>3P</th><th>FT</th><th>+/-</th><th>{en?'Result':'结果'}</th></tr></thead><tbody>{logs.map(row=>{const player=players.get(row.playerId);return player?<tr key={row.id}><td><PlayerLink player={player}/></td><td>{row.matchup}</td><td>{number(row.minutes,0)}</td><td><strong>{number(row.points,0)}</strong></td><td>{number(row.rebounds,0)}</td><td>{number(row.assists,0)}</td><td>{number(row.steals,0)}</td><td>{number(row.blocks,0)}</td><td>{number(row.turnovers,0)}</td><td>{number(row.fieldGoalsMade,0)}-{number(row.fieldGoalsAttempted,0)}</td><td>{number(row.threePointersMade,0)}-{number(row.threePointersAttempted,0)}</td><td>{number(row.freeThrowsMade,0)}-{number(row.freeThrowsAttempted,0)}</td><td>{row.plusMinus>0?'+':''}{number(row.plusMinus,0)}</td><td>{row.result}</td></tr>:null})}</tbody></table></div>{!logs.length&&<Empty title={en?'No game logs':'当前日期暂无记录'} message={en?'Select another date, team, or season type.':'请选择其他比赛日期、球队或赛段。'}/>}<Pagination page={currentPage} total={filteredLogs.length} pageSize={pageSize} onChange={next=>{const updated=new URLSearchParams(params);updated.set('page',String(next));setParams(updated,{replace:true});}}/></section>
    <small className="data-source-caption">{teams.size} 支球队 · {all.length.toLocaleString()} 条已发布官方逐场记录 · {en?'Source: NBA Stats API':'来源：NBA Stats API'}</small><DataMethodNote />
  </>;
}
