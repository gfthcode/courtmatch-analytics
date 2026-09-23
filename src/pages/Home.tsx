import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Database, Search, ShieldCheck, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../components/ui/button';
import { SearchPlayers, PlayerIdentity, Quality, number } from '../components/Common';
import { useData } from '../state';
import { calculateMatchupMetrics, getMatchups, getPlayerById, getRankings, leagueAverage } from '../lib/api';
import './home.css';
import './home-motion.css';
import { useLanguage } from '../i18n';

type LeaderMetric = 'offense' | 'defense';

function formatUpdated(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(date);
}

function ImpactPanel({ label, metric, title, description }: { label: string; metric: LeaderMetric; title: string; description: string }) {
  const data = useData();
  const season = data.seasons[0];
  const rows = useMemo(
    () => getRankings(data, { season, type: 'regular', metric, order: metric === 'defense' ? 'asc' : 'desc', minPossessions: 50 }).slice(0, 3),
    [data, metric, season],
  );

  return (
    <article className={`lab-impact lab-impact-${metric}`} style={{ background: '#fff', backgroundImage: 'none' }}>
      <div className="lab-module-kicker"><span>{label}</span><Activity size={14} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      <ol>
        {rows.map((row, index) => {
          const value = metric === 'defense' ? row.defense : row.offense;
          return <li key={row.player.id}>
            <span className="lab-rank">0{index + 1}</span>
            <Link to={`/players/${row.player.id}?season=${season}`}><PlayerIdentity player={row.player} /></Link>
            <strong>{number(value)}<small>/100</small></strong>
          </li>;
        })}
      </ol>
      <Link className="lab-module-link" to={`/rankings?season=${season}&metric=${metric}&minPossessions=50`}>
        查看完整榜单 <ArrowUpRight size={15} />
      </Link>
    </article>
  );
}

export function HomePage({ onSearch }: { onSearch: () => void }) {
  const data = useData();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const season = data.seasons[0];
  const average = leagueAverage(data, { season, type: 'regular' });
  const matchups = useMemo(
    () => getMatchups(data, { season, type: 'regular', minPossessions: 75 }).sort((a, b) => b.matchupPossessions - a.matchupPossessions),
    [data, season],
  );
  const hotMatchups = matchups.slice(0, 3).flatMap((record) => {
    const offense = getPlayerById(data, record.offensivePlayerId);
    const defense = getPlayerById(data, record.defensivePlayerId);
    return offense && defense ? [{ record, offense, defense, metrics: calculateMatchupMetrics(record, average) }] : [];
  });
  const leaders = useMemo(
    () => getRankings(data, { season, type: 'regular', metric: 'offense', order: 'desc', minPossessions: 50 }).slice(0, 5),
    [data, season],
  );

  const copy = {
    heroDescription: language === 'en' ? 'Use one consistent data definition to explore possession samples, efficiency gaps and defensive constraints.' : '从回合样本、效率差异到防守限制，用同一套数据口径进入比赛的细部。',
    impactOffense: language === 'en' ? 'Weighted summary for players with at least 50 possessions.' : '至少 50 回合的球员加权汇总。',
    impactDefense: language === 'en' ? 'Lower values indicate lower opponent efficiency in the current data.' : '数值越低，代表当前数据下被攻效率越低。',
    offenseLink: language === 'en' ? 'View full rankings' : '查看完整榜单',
    matchupPossessions: language === 'en' ? ' possessions' : ' 对位回合',
    scope: language === 'en' ? 'Scope' : '范围', status: language === 'en' ? 'Status' : '状态',
  };
  return <div className="lab-home">
    <section className="lab-hero" aria-labelledby="lab-hero-title">
      <div className="lab-hero-copy">
        <div className="lab-signal"><i aria-hidden="true" />NBA DATA LAB <span>LIVE ANALYSIS SURFACE</span></div>
        <h1 id="lab-hero-title">{language === 'en' ? <>Read every<br /><em>head-to-head.</em></> : <>读懂每一次<br /><em>正面对位。</em></>}</h1>
        <p className="lab-hero-subtitle">Explore how NBA players perform when directly matched against one another.</p>
        <p className="lab-hero-description">{copy.heroDescription}</p>
        <div className="lab-actions">
          <Button asChild><Link to="/matchups">{t('联盟对位')} <ArrowRight size={17} /></Link></Button>
          <Button variant="secondary" asChild><Link to="/comparison">{t('球员比较')}</Link></Button>
          <Link className="lab-text-action" to="/rankings">{t('排行榜')} <ArrowUpRight size={16} /></Link>
        </div>
      </div>

      <aside className="lab-command-panel" aria-label="球员分析搜索" style={{ background: '#fff', backgroundImage: 'none' }}>
        <div className="lab-panel-topline"><span>ANALYSIS COMMAND</span><kbd>⌘ K</kbd></div>
        <h2>{t('从一名球员开始')}</h2>
        <p>{t('支持中英文姓名、球队、简称与键盘选择。')}</p>
        <SearchPlayers label={t('搜索球员或球队')} onChoose={(player) => navigate(`/players/${player.id}?season=${season}`)} />
        <button className="lab-command-shortcut" type="button" onClick={onSearch}>
          <Search size={15} /> {t('打开全局球员搜索')} <span>⌘ K</span>
        </button>
      </aside>
    </section>

    <section className="lab-metrics" aria-label="当前数据摘要" style={{ background: '#fff', backgroundImage: 'none' }}>
      <article><CalendarDays size={17} /><span>{t('当前赛季')}</span><strong>{season}</strong><small>{t('常规赛分析口径')}</small></article>
      <article><Users size={17} /><span>{t('覆盖球员')}</span><strong>{data.players.length.toLocaleString(language==='en'?'en-US':'zh-CN')}</strong><small>{t('NBA 球员目录')}</small></article>
      <article><Database size={17} /><span>{t('对位记录')}</span><strong>{data.matchups.length.toLocaleString(language==='en'?'en-US':'zh-CN')}</strong><small>{t('可筛选直接对位')}</small></article>
      <article><BarChart3 size={17} /><span>{t('联盟平均效率')}</span><strong>{number(average)}<small>/100</small></strong><small>{t('当前覆盖数据加权值')}</small></article>
    </section>

    <section className="lab-workspace" aria-label="首页分析工作台">
      <div className="lab-section-heading">
        <div><span>01 / HOT MATCHUPS</span><h2>{t('热门直接对位')}</h2></div>
        <Link to="/matchups">{t('进入分析工作台')} <ArrowRight size={17} /></Link>
      </div>
      <div className="lab-matchup-grid">
        {hotMatchups.map(({ record, offense, defense, metrics }, index) => (
          <Link key={record.id} className="lab-matchup-card" style={{ background: '#fff', backgroundImage: 'none' }} to={`/matchups/player/${offense.id}?opponent=${defense.id}&season=${season}&minPossessions=0`}>
            <div><span>NODE {String(index + 1).padStart(2, '0')}</span><Quality quality={metrics.sampleQuality} possessions={record.matchupPossessions} /></div>
            <div className="lab-matchup-players"><PlayerIdentity player={offense} /><span>VS</span><PlayerIdentity player={defense} /></div>
            <footer><strong>{number(metrics.pointsPer100)}<small> /100</small></strong><span>{record.matchupPossessions.toLocaleString(language==='en'?'en-US':'zh-CN')}{copy.matchupPossessions} <ArrowUpRight size={15} /></span></footer>
          </Link>
        ))}
      </div>
    </section>

    <section className="lab-leaders" aria-label="联盟效率领跑者" style={{ background: '#fff', backgroundImage: 'none' }}>
      <div className="lab-section-heading">
        <div><span>02 / LEAGUE LEADERS</span><h2>{t('表现进入视野')}</h2></div>
        <Link to="/rankings">{t('View all rankings')} <ArrowRight size={17} /></Link>
      </div>
      <div className="lab-leader-table">
        <div className="lab-table-head"><span>RANK</span><span>PLAYER</span><span>TEAM</span><span>OFFENSIVE IMPACT</span><span>SAMPLE</span></div>
        {leaders.map((leader) => <Link key={leader.player.id} to={`/players/${leader.player.id}?season=${season}`} className="lab-leader-row">
          <span>#{String(leader.rank).padStart(2, '0')}</span><PlayerIdentity player={leader.player} /><span>{leader.player.teamAbbreviation}</span>
          <span className="lab-impact-bar"><i style={{ '--impact': `${Math.max(6, Math.min(100, leader.offense ?? 0))}%` } as React.CSSProperties} /><b>{number(leader.offense)}</b></span>
          <Quality quality={leader.quality} possessions={leader.possessions} />
        </Link>)}
      </div>
    </section>

    <section className="lab-impact-grid">
      <ImpactPanel label="03A / OFFENSIVE IMPACT" metric="offense" title={t('进攻影响力')} description={copy.impactOffense} />
      <ImpactPanel label="03B / DEFENSIVE IMPACT" metric="defense" title={t('防守限制力')} description={copy.impactDefense} />
    </section>

    <section className="lab-footer-grid">
      <article className="lab-update" style={{ background: '#fff', backgroundImage: 'none' }}><div className="lab-module-kicker"><span>RECENT DATA UPDATE</span><i aria-hidden="true" /></div><h2>{formatUpdated(data.updatedAt)}</h2><p>{data.source}</p><dl><div><dt>{copy.scope}</dt><dd>{data.seasons.join(' · ')}</dd></div><div><dt>{copy.status}</dt><dd>{data.mode === 'live' ? 'LIVE DATA' : 'DEMO DATA'}</dd></div></dl><Link to="/sources">{t('查看数据来源与覆盖范围')} <ArrowUpRight size={16} /></Link></article>
      <article className="lab-method" style={{ background: '#fff', backgroundImage: 'none' }}><ShieldCheck size={25} /><div><span>EXPLORE METHODOLOGY</span><h2>{t('数字需要上下文。')}</h2><p>{t('样本量不等于因果关系。先理解口径，再使用结论。')}</p><Link to="/methodology">{t('阅读方法论')} <ArrowRight size={17} /></Link></div></article>
    </section>
  </div>;
}
