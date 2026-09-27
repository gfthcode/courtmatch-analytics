import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useData } from '../state';
import { useLanguage } from '../i18n';
import { DataMethodNote, Empty, PageHead, Pagination, PlayerLink, number } from '../components/Common';

const categories = ['perGame', 'per36', 'efficiency'] as const;
type Category = typeof categories[number];

export function NBAPlayerStatsPage() {
  const data = useData();
  const { language } = useLanguage();
  const en = language === 'en';
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
  const set = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); next.delete('page'); setParams(next, { replace: true }); };
  const columns = useMemo(() => {
    const stat = (key: keyof typeof data.playerStats[number]) => (row: typeof data.playerStats[number]) => typeof row[key] === 'number' ? row[key] as number : null;
    const rate = (label: string, key: keyof typeof data.playerStats[number]) => ({ label, value: stat(key), percent: true });
    const ordinary = (label: string, key: keyof typeof data.playerStats[number]) => ({ label, value: stat(key), percent: false });
    if (category === 'per36') return (['pointsPerGame','reboundsPerGame','assistsPerGame','stealsPerGame','blocksPerGame'] as const).map((key,index)=>({label:['PTS/36','REB/36','AST/36','STL/36','BLK/36'][index],value:(row:typeof data.playerStats[number])=>row.minutesPerGame?row[key]*36/row.minutesPerGame:null,percent:false}));
    if (category === 'efficiency') return [rate('FG%', 'fieldGoalPercentage'), rate('3P%', 'threePointPercentage'), rate('FT%', 'freeThrowPercentage'), rate('eFG%', 'effectiveFieldGoalPercentage'), rate('TS%', 'trueShootingPercentage'), rate('USG%', 'usagePercentage'), ordinary('ORtg', 'offensiveRating'), ordinary('DRtg', 'defensiveRating')];
    return [ordinary('MIN','minutesPerGame'),ordinary('PTS','pointsPerGame'),ordinary('REB','reboundsPerGame'),ordinary('AST','assistsPerGame'),ordinary('STL','stealsPerGame'),ordinary('BLK','blocksPerGame'),rate('FG%','fieldGoalPercentage'),rate('3P%','threePointPercentage'),rate('FT%','freeThrowPercentage')];
  }, [category, data.playerStats]);
  const activeSort = columns.find(column => column.label === sort) ?? columns[0];
  const players = new Map(data.players.map(player => [player.id, player]));
  const rows = data.playerStats.filter(stat => stat.season === season && stat.seasonType === type && stat.gamesPlayed > 0 && (stat.minutesPerGame ?? 0) * stat.gamesPlayed >= minMinutes).map(stat => ({ stat, player: players.get(stat.playerId) })).filter((row): row is {stat:typeof data.playerStats[number];player:typeof data.players[number]} => !!row.player && (!team || row.player.teamId === team) && (!query || [row.player.name,row.player.chineseName,row.player.teamAbbreviation].some(value=>value.toLowerCase().includes(query.toLowerCase())))).sort((a,b)=>{const av=activeSort.value(a.stat),bv=activeSort.value(b.stat);if(av==null)return bv==null?0:1;if(bv==null)return -1;return (bv-av)*direction;});
  const rowsPage = rows.slice((page-1)*25,page*25);
  return <><PageHead eyebrow="NBA STATS · OFFICIAL" title={en?'NBA Player Stats':'NBA 球员统计榜'} description={en?'Traditional NBA Stats season leaders, with totals, per-36 rates and shooting efficiency.':'NBA Stats 官方赛季统计：支持场均、累计、每36分钟和投篮效率榜。'} />
    <section className="directory-toolbar"><label className="field"><span>{en?'Season':'赛季'}</span><select value={season} onChange={e=>set('season',e.target.value)}>{data.seasons.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>{en?'Season type':'赛段'}</span><select value={type} onChange={e=>set('type',e.target.value)}><option value="regular">{en?'Regular season':'常规赛'}</option><option value="playoffs">{en?'Playoffs':'季后赛'}</option></select></label><label className="field"><span>{en?'Category':'统计口径'}</span><select value={category} onChange={e=>set('category',e.target.value)}><option value="perGame">{en?'Per game':'场均'}</option><option value="per36">{en?'Per 36 minutes':'每36分钟'}</option><option value="efficiency">{en?'Efficiency':'效率'}</option></select></label><label className="field"><span>{en?'Team':'球队'}</span><select value={team} onChange={e=>set('team',e.target.value)}><option value="">{en?'All teams':'全部球队'}</option>{data.teams.map(value=><option key={value.id} value={value.id}>{value.abbreviation}</option>)}</select></label><label className="field"><span><Search size={14}/>{en?'Search':'搜索球员'}</span><input value={query} onChange={e=>set('q',e.target.value)} placeholder={en?'Player / team':'姓名或球队'} /></label><label className="field"><span>{en?'Minimum season minutes':'最低赛季分钟'}</span><input type="number" min="0" value={minMinutes} onChange={e=>set('minMinutes',e.target.value)} /></label></section>
    <section className="section table-section"><div className="section-title"><div><h2>{en?'Season leaders':'赛季领跑者'}</h2><p>{rows.length} {en?'players · Source: NBA Stats API':'位球员 · 来源：NBA Stats API'}</p></div><small>{data.manifest.playerStatsSourceUpdatedAt?.slice(0,10)??data.updatedAt.slice(0,10)}</small></div>
    <div className="table-scroll"><table><thead><tr><th>{en?'Rank':'排名'}</th><th>{en?'Player':'球员'}</th><th>{en?'Team':'球队'}</th><th>{en?'Position':'位置'}</th>{columns.map(column=><th key={column.label}><button className="text-button" onClick={()=>{const next=params.get('sort')===column.label&&params.get('order')!=='asc'?'asc':'desc';const p=new URLSearchParams(params);p.set('sort',column.label);p.set('order',next);p.delete('page');setParams(p,{replace:true});}}>{column.label}{sort===column.label?(direction===-1?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{rowsPage.map(({stat,player},index)=><tr key={stat.playerId+'-'+stat.seasonType}><td>{(page-1)*25+index+1}</td><td><PlayerLink player={player}/></td><td>{player.teamAbbreviation}</td><td>{player.position==='Unknown'&&!en?'未核验':player.position}</td>{columns.map(column=>{const value=column.value(stat);return <td key={column.label}>{value==null?'—':column.percent?((value*100).toFixed(1)+'%'):value.toFixed(1)}</td>;})}</tr>)}</tbody></table></div>{!rows.length&&<Empty title={en?'No players match':'没有匹配球员'} message={en?'Try a lower minute threshold or clear filters.':'调低出场分钟门槛或清除筛选。'}/>}<Pagination page={page} total={rows.length} pageSize={25} onChange={next=>set('page',String(next))}/></section>
    <DataMethodNote />
  </>;
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
