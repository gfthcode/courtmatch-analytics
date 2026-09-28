import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PlayerIdentity, Quality, number, signed, PlayerLink, Empty } from '../components/Common';
import { useLanguage } from '../i18n';
import { useData } from '../state';
import { calculateMatchupMetrics, getMatchups, getPlayerById, getRankings, leagueAverage } from '../lib/api';
import './home-legacy.css';

type ChartMetric = 'offense' | 'defense' | 'possessions';

const chartChoices: Array<{ key: ChartMetric; label: string }> = [
  { key: 'offense', label: '进攻效率' },
  { key: 'defense', label: '防守限制' },
  { key: 'possessions', label: '对位回合' },
];

const summaryChoices = [
  { label: '进攻效率领先', metric: 'offense', order: 'desc' },
  { label: '防守限制领先', metric: 'defense', order: 'asc' },
  { label: '对位回合领先', metric: 'possessions', order: 'desc' },
  { label: '效率提升领先', metric: 'improvement', order: 'desc' },
  { label: '效率下降最多', metric: 'improvement', order: 'asc' },
] as const;

export function HomePage({ onSearch }: { onSearch: () => void }) {
  const data = useData();
  const { t } = useLanguage();
  const season = data.seasons[0];
  const [chartMetric, setChartMetric] = useState<ChartMetric>('offense');
  const chartConfig = {
    offense: { title: '进攻对位效率', description: '每 100 个进攻对位回合得分，数值越高越好。', unit: '每 100 回合' },
    defense: { title: '防守限制效率', description: '对手每 100 个进攻对位回合得分，数值越低越好。', unit: '每 100 回合' },
    possessions: { title: '对位样本回合', description: '统计该球员作为进攻方或防守方的对位回合总量。', unit: '对位回合' },
  }[chartMetric];
  const ranks = getRankings(data, {
    season,
    type: 'regular',
    metric: chartMetric,
    order: chartMetric === 'defense' ? 'asc' : 'desc',
    minPossessions: 25,
  }).slice(0, 8);
  const chartMax = chartMetric === 'possessions'
    ? Math.max(100, Math.ceil((ranks[0]?.possessions ?? 0) / 500) * 500)
    : 100;
  const chartTicks = [0, 1, 2, 3, 4].map((step) => Math.round(chartMax * step / 4));
  const featured = getMatchups(data, { season, type: 'regular', minPossessions: 75 })
    .sort((left, right) => right.matchupPossessions - left.matchupPossessions)
    .slice(0, 3);
  const focus = featured[0];
  const offensePlayer = focus && getPlayerById(data, focus.offensivePlayerId);
  const defensePlayer = focus && getPlayerById(data, focus.defensivePlayerId);
  const average = leagueAverage(data, { season, type: 'regular' });

  return (
    <div className="home-v2">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">BASKETBALL, UNDER THE SURFACE.</p>
          <h1>{t('读懂每一次')}<br /><em>{t('正面对位。')}</em></h1>
          <p className="hero-description">{t('用直接对位数据，看清谁在攻防回合中真正占据上风。')}</p>
          <Button variant="default" className="hero-search" onClick={onSearch}>
            <Search size={19} />
            <span>{t('搜索球员，开始探索')}<small>Search a player</small></span>
            <kbd>⌘ K</kbd>
            <ArrowRight size={20} />
          </Button>
          <Link className="text-link" to="/comparison">{t('比较两名球员')} <ArrowUpRight size={17} /></Link>
        </div>
        <div className="hero-board">
          {focus && offensePlayer && defensePlayer ? <>
            <div className="board-top"><span>FEATURED DIRECT MATCHUP</span><span>{season}</span></div>
            <div className="hero-players">
              <div><span className="jersey">{offensePlayer.jerseyNumber}</span><PlayerIdentity player={offensePlayer} large /></div>
              <span className="versus">VS</span>
              <div><span className="jersey">{defensePlayer.jerseyNumber}</span><PlayerIdentity player={defensePlayer} large /></div>
            </div>
            <div className="board-score">
              <div><strong>{number(calculateMatchupMetrics(focus).pointsPer100)}</strong><span>{t('进攻方每 100 对位回合得分')}</span></div>
              <Quality quality="high" possessions={focus.matchupPossessions} />
            </div>
            <Link to={`/matchups/player/${offensePlayer.id}?opponent=${defensePlayer.id}&season=${season}&minPossessions=0`} className="board-link">
              {t('进入这组对位')} <ArrowUpRight size={20} />
            </Link>
          </> : <Empty title={t('暂无精选对位')} />}
        </div>
      </section>

      <div className="brand-ribbon">
        <strong>THE GAME WITHIN THE GAME</strong>
        <span>{t('球员 → 视角 → 样本 → 对位')}</span>
        <Link to="/matchups">{t('打开分析工作台')} <ArrowUpRight size={18} /></Link>
      </div>

      <section className="section">
        <div className="section-title">
          <div><h2>{t('每一组对位，都有细节。')}</h2><p>{t('从样本量充足的记录切入，再看效率差异。')}</p></div>
          <Link className="text-link" to="/matchups">{t('全部对位')} <ArrowRight size={17} /></Link>
        </div>
        <div className="matchup-highlights">
          {featured.map((record, index) => {
            const offense = getPlayerById(data, record.offensivePlayerId)!;
            const defense = getPlayerById(data, record.defensivePlayerId)!;
            const metrics = calculateMatchupMetrics(record, average);
            return (
              <article key={record.id} className="highlight">
                <div className="highlight-top"><span>{t('精选对位')} {String(index + 1).padStart(2, '0')}</span><Quality quality={metrics.sampleQuality} possessions={record.matchupPossessions} /></div>
                <PlayerLink player={offense} />
                <span className="versus-small">{t('进攻面对')}</span>
                <PlayerLink player={defense} />
                <div className="highlight-metric"><strong>{number(metrics.pointsPer100)}</strong><span>{t('每 100 回合得分')}<br />{signed(metrics.differenceFromLeagueAverage)}% {t('相对数据集均值')}</span></div>
                <Button asChild><Link to={`/matchups/player/${offense.id}?opponent=${defense.id}&season=${season}&minPossessions=0`}>{t('查看对位详情')} <ArrowUpRight size={17} /></Link></Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section home-rank">
        <div>
          <p className="eyebrow">LEAGUE LEADERS</p>
          <h2>{t('让表现')}<br />{t('进入视野。')}</h2>
          <p>{t('基于同一赛季、同一口径的对位回合加权汇总。')}</p>
          <div className="leader-summary">
            {summaryChoices.map(({ label, metric, order }) => {
              const leader = getRankings(data, { season, type: 'regular', metric, order, minPossessions: 25 })[0];
              return <div key={label}><span>{t(label)}</span>{leader
                ? <Link to={`/players/${leader.player.id}?season=${season}`}>{leader.player.shortName}<ArrowUpRight size={13} /></Link>
                : <span>{t('暂无数据')}</span>}</div>;
            })}
          </div>
          <Button asChild><Link to="/rankings">{t('进入排行榜')} <ArrowRight size={17} /></Link></Button>
        </div>
        <article className="ranking-feature-chart">
          <header>
            <div><h3>{t(chartConfig.title)}</h3><p>{t(chartConfig.description)} {t('点击球员打开画像。')}</p></div>
            <span className="ranking-chart-unit">{t(chartConfig.unit)}</span>
          </header>
          <div className="ranking-chart-controls" role="group" aria-label={t('选择榜单指标')}>
            {chartChoices.map((option) => <button key={option.key} type="button" aria-pressed={chartMetric === option.key} onClick={() => setChartMetric(option.key)}>{t(option.label)}</button>)}
          </div>
          <div className="ranking-chart-scale" aria-hidden="true"><div /><div className="ranking-chart-ticks">{chartTicks.map((tick, index) => <span key={`${tick}-${index}`}>{number(tick, 0)}</span>)}</div><div /></div>
          <ol>
            {ranks.map((row, index) => {
              const value = chartMetric === 'offense' ? row.offense : chartMetric === 'defense' ? row.defense : row.possessions;
              const metricLabel = chartMetric === 'offense' ? '进攻对位效率' : chartMetric === 'defense' ? '防守限制效率' : '对位回合';
              return <li key={row.player.id}><Link to={`/players/${row.player.id}?season=${season}`} className="ranking-chart-row" aria-label={`${row.player.name}, ${t(metricLabel)} ${number(value, chartMetric === 'possessions' ? 0 : 1)}`}>
                <span className="ranking-chart-rank">{String(index + 1).padStart(2, '0')}</span>
                <PlayerIdentity player={row.player} size="medium" />
                <span className="ranking-chart-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, (value ?? 0) / chartMax * 100))}%` }} /></span>
                <strong>{number(value, chartMetric === 'possessions' ? 0 : 1)}</strong>
              </Link></li>;
            })}
          </ol>
        </article>
      </section>

      <section className="method-teaser">
        <h2>{t('数字需要上下文。')}</h2>
        <p>{t('每一项效率都附带样本回合和比较基准。样本多不代表因果关系，了解算法后再做判断。')}</p>
        <Link className="text-link" to="/methodology">{t('阅读方法论')} <ArrowUpRight size={18} /></Link>
      </section>
    </div>
  );
}
