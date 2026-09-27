import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, CheckCircle2, ExternalLink, Globe2, History, Rocket, Search, Shield, WalletCards } from 'lucide-react';
import { useData, useDataStatus } from '../state';
import { getRankings, getTeamPlayTypes, getTeamStats } from '../lib/api';
import { DataMethodNote, Empty, PageHead, Pagination, PlayerLink, number } from '../components/Common';
import { Chart, scatterOption } from '../components/Charts';
import { Button } from '../components/ui/button';
import { NBAPlayerStatsPage, NBADailyPage } from './NBAStatsPages';

function StatusCard({ label='数据状态' }: { label?: string }) {
  const status = useDataStatus();
  const unavailable = status.state === 'unavailable';
  const tone = status.state === 'live' || status.state === 'recently-updated' ? 'success' : unavailable ? 'warning' : 'muted';
  return <div className={`data-availability data-availability-${tone}`} role="status"><span className="status-dot" /><div><strong>{label}：{status.state === 'live' ? 'LIVE DATA' : status.state === 'recently-updated' ? 'RECENTLY UPDATED' : status.state === 'stale' ? 'STALE DATA' : status.state === 'demo' ? 'DEMO DATA' : 'DATA UNAVAILABLE'}</strong><small>{status.message ?? status.coverage} · 更新 {status.lastUpdated.slice(0, 10)}</small></div></div>;
}

export function PlayerDirectoryPage() { return <NBAPlayerStatsPage />; }

export function TeamDirectoryPage() {
  const { pathname: routePath } = useLocation();
  if (routePath === '/team' || routePath === '/team/') return <TeamScatterPage />;
  const data = useData(); const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const pageSize = 12;
  const rows = data.teams.filter((t) => [t.id, t.name, t.chineseName, t.abbreviation].some((v) => v.toLowerCase().includes(query.toLowerCase()))).slice((page - 1) * pageSize, page * pageSize);
  return <><PageHead eyebrow="TEAM DIRECTORY" title="球队数据" description="查看 NBA 球队目录与已发布的球队统计入口；球队数据只显示当前数据集真实覆盖范围。" /><StatusCard /><section className="directory-toolbar"><label className="field"><span><Search size={14} /> 搜索球队</span><input value={query} placeholder="球队名称或缩写" onChange={(e) => { setQuery(e.target.value); setPage(1); }} /></label></section><section className="directory-grid team-directory">{rows.map((team) => { const stats = getTeamStats(data, team.id, { season: data.seasons[0] })[0]; return <article className="directory-card" key={team.id}><div className="team-mark" aria-hidden="true">{team.abbreviation.slice(0, 2)}</div><div><h3>{team.chineseName}</h3><p>{team.name} · {team.id}</p></div><dl><div><dt>进攻效率</dt><dd>{number(stats?.offensiveRating)}</dd></div><div><dt>防守效率</dt><dd>{number(stats?.defensiveRating)}</dd></div><div><dt>节奏</dt><dd>{number(stats?.pace)}</dd></div></dl><Link className="card-link" to={`/teams/${team.id}`}>查看球队详情 →</Link></article>; })}</section>{!rows.length && <Empty title="没有匹配的球队" message="请使用球队名称或缩写搜索。" />}<Pagination page={page} total={data.teams.filter((t) => [t.id, t.name, t.chineseName, t.abbreviation].some((v) => v.toLowerCase().includes(query.toLowerCase()))).length} pageSize={pageSize} onChange={setPage} /></>;
}

export function TeamScatterPage() {
  const data = useData(); const [params, setParams] = useSearchParams();
  const season = params.get('season') ?? data.seasons[0] ?? ''; const type = params.get('type') === 'playoffs' ? 'playoffs' : 'regular'; const flip = params.get('flip') === '1'; const display = params.get('display') === 'fill' ? 'fill' : 'number';
  const stats = data.teams.map((team) => ({ team, stats: getTeamStats(data, team.id, { season, type })[0] })).filter((row) => row.stats?.offensiveRating != null && row.stats.defensiveRating != null);
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const rows = stats.map(({ team, stats: row }) => ({ id: team.id, name: team.abbreviation, possessions: row?.pace ?? 0, efficiency: flip ? row!.defensiveRating! : row!.offensiveRating!, points: row?.wins ?? 0 }));
  return <><PageHead eyebrow="TEAM SCATTER" title="联盟散点" description="用已发布的球队攻防指标观察联盟分布；缺少真实球队统计时，页面明确显示不可用状态。" /><StatusCard /><section className="directory-toolbar"><label className="field"><span>赛季</span><select value={season} onChange={(event) => update('season', event.target.value)}>{data.seasons.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>比赛类型</span><select value={type} onChange={(event) => update('type', event.target.value)}><option value="regular">常规赛</option><option value="playoffs">季后赛</option></select></label><label className="check-field"><input type="checkbox" checked={flip} onChange={(event) => update('flip', event.target.checked ? '1' : '')}/><span>互换 X/Y 轴</span></label><div className="display-toggle" role="group" aria-label="图表显示模式"><Button variant={display === 'number' ? 'default' : 'secondary'} onClick={() => update('display', 'number')}>Number</Button><Button variant={display === 'fill' ? 'default' : 'secondary'} onClick={() => update('display', 'fill')}>Fill</Button></div></section>{rows.length ? <Chart title="球队攻防分布" description={`${season} · ${flip ? '防守效率' : '进攻效率'}与节奏分布；点击球队名称进入球队详情。`} option={scatterOption(rows, rows.reduce((sum, row) => sum + row.efficiency, 0) / rows.length, 0)} onClick={(id) => { window.location.href = `/courtmatch-analytics/teams/${id}`; }} /> : <section className="unavailable-panel"><BarChart3 size={30} /><h2>当前数据目录未发布球队统计</h2><p>球队散点需要真实的球队效率和节奏字段；当前页面保留筛选与图表入口，等待 team_stats 数据接入后自动启用。</p><Link className="card-link" to="/teams">查看球队目录 →</Link></section>}<DataMethodNote /></>;
}

export function TeamDetailPage() {
  const data = useData(); const { teamId } = useParams(); const team = data.teams.find((t) => t.id === teamId); const stats = team ? getTeamStats(data, team.id, { season: data.seasons[0] })[0] : undefined;
  if (!team) return <Empty title="未找到球队" message="请从球队数据目录选择有效球队。"><Button asChild><Link to="/teams">返回球队数据</Link></Button></Empty>;
  const players = data.players.filter((p) => p.teamId === team.id);
  return <><PageHead eyebrow="TEAM PROFILE" title={`${team.chineseName} · ${team.abbreviation}`} description={`${team.name} 的球队目录、赛季效率和当前发布数据覆盖。`} /><StatusCard /><div className="metrics-grid"><article className="metric"><span className="metric-label">进攻效率</span><strong>{number(stats?.offensiveRating)}</strong><p>{data.seasons[0]} · 当前数据</p></article><article className="metric"><span className="metric-label">防守效率</span><strong>{number(stats?.defensiveRating)}</strong><p>数值越低通常代表限制得分更好</p></article><article className="metric"><span className="metric-label">节奏</span><strong>{number(stats?.pace)}</strong><p>当前覆盖赛季</p></article></div><section className="section"><div className="section-title"><h2>球队球员</h2><Link to="/players">打开球员目录 →</Link></div><div className="directory-list">{players.map((player) => <PlayerLink key={player.id} player={player} />)}</div></section><DataMethodNote /></>;
}

export function TeamAnalysisPage() {
  const data = useData();
  const [params, setParams] = useSearchParams();
  const teamId = params.get('team') ?? data.teams[0]?.id ?? '';
  const season = params.get('season') ?? data.seasons[0] ?? '';
  const seasonType = params.get('type') === 'playoffs' ? 'playoffs' : 'regular';
  const [grouping, setGrouping] = useState<'offensive' | 'defensive'>('offensive');
  const team = data.teams.find((item) => item.id === teamId);
  const stats = team ? getTeamStats(data, team.id, { season, type: seasonType })[0] : undefined;
  const playRows = team ? getTeamPlayTypes(data, team.id, { season, type: seasonType }).filter((row) => row.grouping === grouping).sort((a, b) => b.possessions - a.possessions) : [];
  const maxPossessions = Math.max(...playRows.map((row) => row.possessions), 0.1);
  const sourceUpdated = data.manifest.teamPlaytypesSourceUpdatedAt?.slice(0, 10) ?? '—';
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const playLabels: Record<string, string> = { Isolation: '单打', Transition: '转换进攻', PRBallHandler: '挡拆持球', PRRollman: '挡拆顺下', Postup: '低位', Spotup: '定点投篮', Handoff: '手递手', Cut: '空切', OffScreen: '绕掩护', OffRebound: '进攻篮板', Misc: '其他' };
  return <><PageHead eyebrow="TEAM ANALYSIS" title="球队打法与攻防" description="使用 NBA Synergy 球队端数据，比较各类进攻方式的频率、每回合得分与提供方百分位。" /><StatusCard /><section className="directory-toolbar team-analysis-filters"><label className="field"><span>选择球队</span><select value={teamId} onChange={(event) => setFilter('team', event.target.value)}>{data.teams.map((item) => <option key={item.id} value={item.id}>{item.abbreviation} · {item.chineseName}</option>)}</select></label><label className="field"><span>赛季</span><select value={season} onChange={(event) => setFilter('season', event.target.value)}>{(data.seasons.includes('2025-26') ? ['2025-26'] : data.seasons).map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>赛段</span><select value={seasonType} onChange={(event) => setFilter('type', event.target.value)}><option value="regular">常规赛</option><option value="playoffs">季后赛</option></select></label></section>{team ? <><div className="metrics-grid"><article className="metric"><span className="metric-label">进攻效率</span><strong>{number(stats?.offensiveRating)}</strong><p>{season} · 已发布球队统计</p></article><article className="metric"><span className="metric-label">防守效率</span><strong>{number(stats?.defensiveRating)}</strong><p>数值越低通常代表限制得分更好</p></article><article className="metric"><span className="metric-label">节奏</span><strong>{number(stats?.pace)}</strong><p>回合/场 · 已发布球队统计</p></article></div><section className="team-playtype-panel section"><header className="team-playtype-header"><div><span className="eyebrow">NBA SYNERGY · TEAM</span><h2>{team.chineseName}打法分布</h2><p>{season} · {seasonType === 'regular' ? '常规赛' : '季后赛'} · 来源快照 {sourceUpdated}</p></div><div className="playtype-tabs" role="group" aria-label="球队打法攻防分组"><Button variant={grouping === 'offensive' ? 'default' : 'secondary'} onClick={() => setGrouping('offensive')}>进攻打法</Button><Button variant={grouping === 'defensive' ? 'default' : 'secondary'} onClick={() => setGrouping('defensive')}>防守端</Button></div></header>{playRows.length ? <><div className="team-playtype-summary"><span><strong>{playRows.length}</strong> 类打法</span><span><strong>{playRows[0]?.gamesPlayed ?? 0}</strong> 场样本</span><span>{grouping === 'offensive' ? '进攻每回合得分' : '对手每回合得分'}均值 <strong>{number(playRows.reduce((sum, row) => sum + (row.pointsPerPossession ?? 0), 0) / Math.max(1, playRows.filter((row) => row.pointsPerPossession != null).length), 3)}</strong></span></div><div className="team-playtype-list">{playRows.map((row, index) => <article className="team-playtype-row" key={`${row.teamId}-${row.playType}-${row.grouping}-${row.seasonType}`}><span className="team-playtype-rank">{String(index + 1).padStart(2, '0')}</span><div className="team-playtype-name"><strong>{playLabels[row.playType] ?? row.playType}</strong><small>{row.playType}</small></div><div className="team-playtype-volume"><div><span>场均回合 {number(row.possessions)}</span><span>使用占比 {row.possessionShare == null ? '—' : `${number(row.possessionShare * 100)}%`}</span></div><i><b style={{ width: `${Math.max(2, row.possessions / maxPossessions * 100)}%` }} /></i></div><div className="team-playtype-metric"><small>{grouping === 'offensive' ? '每回合得分' : '对手每回合得分'}</small><strong>{number(row.pointsPerPossession, 3)}</strong></div><div className="team-playtype-metric"><small>提供方百分位</small><strong>{row.percentile == null ? '—' : `${Math.round(row.percentile * 100)}%`}</strong></div></article>)}</div><p className="team-playtype-source">字段来自参考仓库公布的 NBA Synergy 球队导出；场均回合和使用占比是频率口径，不是赛季累计。来源更新日期：{sourceUpdated}。<a href="https://github.com/suren504/surennba_stats/blob/main/team_playtype.py" target="_blank" rel="noreferrer">查看采集脚本 ↗</a></p></> : <div className="unavailable-panel"><BarChart3 size={24} /><h2>该赛段暂无已发布球队打法记录</h2><p>当前数据源没有提供 {season} {seasonType === 'regular' ? '常规赛' : '季后赛'}的这支球队记录；不会使用球员数据推算球队打法。</p></div>}</section><section className="notice-card"><Shield size={18} /><span>球队效率字段只展示已发布数据；打法百分位是来源样本内的相对位置，不是 NBA 官方排名。历史快照可能落后于当前赛季。</span></section><Link className="card-link" to={`/teams/${team.id}`}>打开 {team.chineseName} 球队详情 →</Link></> : <Empty title="未找到球队" message="请从球队选择器中选择有效球队。" />}</>;
}

export function TeamComparePage() {
  const data = useData();
  const [params, setParams] = useSearchParams();
  const leftId = params.get('left') ?? data.teams[0]?.id ?? '';
  const rightId = params.get('right') ?? data.teams[1]?.id ?? data.teams[0]?.id ?? '';
  const left = data.teams.find((item) => item.id === leftId);
  const right = data.teams.find((item) => item.id === rightId);
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }); };
  const card = (team: typeof left) => { if (!team) return <article className="unavailable-panel"><h2>未选择球队</h2></article>; const stats = getTeamStats(data, team.id, { season: data.seasons[0] })[0]; return <article className="directory-card"><div className="team-mark" aria-hidden="true">{team.abbreviation.slice(0, 2)}</div><h2>{team.chineseName}</h2><p>{team.name} · {data.seasons[0]}</p><dl><div><dt>进攻效率</dt><dd>{number(stats?.offensiveRating)}</dd></div><div><dt>防守效率</dt><dd>{number(stats?.defensiveRating)}</dd></div><div><dt>节奏</dt><dd>{number(stats?.pace)}</dd></div></dl><Link className="card-link" to={`/teams/${team.id}`}>查看详情 →</Link></article>; };
  return <><PageHead eyebrow="TEAM COMPARISON" title="球队对比" description="并排查看两支 NBA 球队的已发布赛季效率指标；空值保持为 —。" /><StatusCard /><section className="directory-toolbar"><label className="field"><span>左侧球队</span><select value={leftId} onChange={(event) => update('left', event.target.value)}>{data.teams.map((item) => <option key={item.id} value={item.id}>{item.abbreviation} · {item.chineseName}</option>)}</select></label><label className="field"><span>右侧球队</span><select value={rightId} onChange={(event) => update('right', event.target.value)}>{data.teams.map((item) => <option key={item.id} value={item.id}>{item.abbreviation} · {item.chineseName}</option>)}</select></label></section><div className="directory-grid team-directory">{card(left)}{card(right)}</div><DataMethodNote /></>;
}

export function SalariesPage() {
  const [showAudit, setShowAudit] = useState(false);
  const fields = [
    ['球员薪资', '未发布', '需要逐球员赛季薪资与币种字段'],
    ['合同年限', '未发布', '需要合同起止赛季和选项年字段'],
    ['合同总额', '未发布', '需要可追溯的合同来源与校验时间'],
    ['球队工资总额', '未发布', '需要球队赛季薪资汇总字段'],
  ];
  return <>
    <PageHead eyebrow="SALARY VAULT" title="薪金仓库" description="薪资数据需要可靠、可追溯的公开来源；当前数据目录未发布薪资字段。" />
    <StatusCard />
    <section className="salary-overview-grid" aria-label="薪资数据状态">
      <article className="salary-overview-card salary-overview-card-primary"><WalletCards size={24} /><span>当前状态</span><strong>等待可信数据源</strong><p>不会用估算值或旧合同填充金额。</p></article>
      <article className="salary-overview-card"><span>已核验公开脚本</span><strong>0 个薪资字段</strong><p>参考仓库当前公开脚本聚焦对位、打法、球队与球员日志。</p></article>
      <article className="salary-overview-card"><span>接入门槛</span><strong>4 项校验</strong><p>来源、赛季、币种、更新时间均需进入 manifest。</p></article>
    </section>
    <section className="section salary-fields-section">
      <div className="section-title"><div><span className="eyebrow">SCHEMA CHECK</span><h2>计划接入字段</h2></div><button className="text-button" type="button" onClick={() => setShowAudit((value) => !value)}>{showAudit ? '收起核验说明' : '查看核验说明'} ↗</button></div>
      <div className="salary-fields-grid">{fields.map(([label, state, detail]) => <article className="salary-field-card" key={label}><span className="status-dot status-dot-muted" /><div><strong>{label}</strong><small>{state}</small><p>{detail}</p></div></article>)}</div>
      {showAudit && <div className="salary-audit-note"><strong>核验结论</strong><p>已检查参考站公开页面与 <code>suren504/surennba_stats</code> 的 README 及脚本目录：当前没有可直接复用的 salary / contract / payroll 输出。接入前需要新增独立数据源，并通过字段完整性、赛季一致性和更新时间校验。</p></div>}
    </section>
    <section className="section salary-sources-section"><div className="section-title"><div><span className="eyebrow">SOURCE MAP</span><h2>可追溯数据入口</h2></div><span>点击查看原始来源</span></div><div className="salary-source-list"><a href="https://www.nba.com/stats" target="_blank" rel="noreferrer"><span>NBA Stats</span><small>官方统计入口，不代表当前已提供薪资字段</small><ExternalLink size={16} /></a><a href="https://github.com/suren504/surennba_stats" target="_blank" rel="noreferrer"><span>参考 GitHub 仓库</span><small>查看公开抓取脚本与数据发布说明</small><ExternalLink size={16} /></a><Link to="/methodology"><span>CourtMatch 数据口径</span><small>查看发布、质量门禁和字段说明</small><ExternalLink size={16} /></Link></div></section>
  </>;
}

export function FuturePage() { return <><PageHead eyebrow="PRODUCT ROADMAP" title="未来展望" description="CourtMatch 的公开产品路线图：只标记已完成、开发中和计划中的功能。" /><section className="roadmap-grid">{[['已完成','NBA-only 数据边界、GitHub JSON 发布层、对位筛选、排行榜、双人比较、抽屉导航'],['正在开发','官方球员目录 ID 映射、生产数据管线、数据质量报告'],['计划开发','历史赛季扩展、更多球队画像、可审计的每日摘要'],['明确边界','WNBA 暂不支持；预测模型不会在可靠数据和验证方案完成前上线']].map(([title, copy], i) => <article className="roadmap-card" key={title}><span>0{i + 1}</span><Rocket size={18} /><h2>{title}</h2><p>{copy}</p></article>)}</section><DataMethodNote /></>; }

export function ImpactPage() { const data = useData(); const rankings = getRankings(data, { season: data.seasons[0], type: 'regular', minPossessions: 25, metric: 'edge', order: 'desc' }).slice(0, 12); return <><PageHead eyebrow="OFFENSE × DEFENSE" title="攻防影响" description="用当前数据集中的对位效率、对位回合和联盟基准观察攻防影响；不把结果解释为因果评分。" /><StatusCard /><DataMethodNote /><section className="section"><div className="section-title"><h2>当前覆盖范围的攻防影响</h2><span>{rankings.length} 位达到最低样本门槛的球员</span></div><div className="impact-list">{rankings.map((r) => <article key={r.player.id}><PlayerLink player={r.player} /><span><b>{number(r.offense)}</b><small>进攻 /100</small></span><span><b>{number(r.defense)}</b><small>被攻 /100</small></span><span className={r.edge && r.edge >= 0 ? 'positive' : 'negative'}><b>{r.edge == null ? '—' : `${r.edge >= 0 ? '+' : ''}${number(r.edge)}`}</b><small>防守压制</small></span></article>)}</div></section></>; }

export function DailyPage() { return <NBADailyPage />; }

export function CountriesPage() { const data = useData(); const countries = [{ name: 'Unknown / 未知', count: data.players.length, players: data.players }]; return <><PageHead eyebrow="PLAYER ORIGINS" title="球员国家" description="国家字段只有在可靠球员目录映射后才会发布；当前目录尚未提供可验证国家字段。" /><StatusCard /><section className="unavailable-panel"><Globe2 size={30} /><h2>当前球员国家字段不可用</h2><p>不根据姓名、球队或其他线索猜测国家。未映射球员统一保留为 Unknown。</p><div className="country-summary"><strong>{countries[0].count}</strong><span>名球员待映射</span></div></section><section className="section"><div className="section-title"><h2>未映射报告</h2><Link to="/players">查看球员目录 →</Link></div><div className="directory-list">{countries[0].players.slice(0, 8).map((p) => <PlayerLink key={p.id} player={p} />)}</div></section></>; }

export function ChangelogPage() { const data = useData(); const status = useDataStatus(); return <><PageHead eyebrow="RELEASE LOG" title="更新日志" description="版本、数据计数和发布状态来自当前数据 manifest；失败更新不会覆盖上一份有效发布。" /><StatusCard label="发布状态" /><section className="timeline"><article><History size={20} /><div><strong>{status.version}</strong><span>{status.lastUpdated}</span><p>{data.players.length} 位球员 · {data.teams.length} 支球队 · {data.matchups.length.toLocaleString()} 条对位记录 · {data.playtypes.length.toLocaleString()} 条打法记录</p><small>来源：{data.source}。GitHub Actions 数据更新失败时保留旧数据并标记状态。</small></div><CheckCircle2 className="timeline-check" size={18} /></article></section><DataMethodNote /></>; }

export function PlayerDetailRoute() { return null; }
