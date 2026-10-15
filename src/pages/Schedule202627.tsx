import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Radio } from 'lucide-react';
import { useLanguage } from '../i18n';

type ScheduleGame = {
  id: number;
  dateET: string;
  startET: string;
  dateBeijing: string;
  timeBeijing: string;
  away: string;
  home: string;
  venueType: 'home' | 'neutral';
};
type ScheduleData = {
  season: string;
  sourceAsOf: string;
  sourceUrl: string;
  scheduledGames: number;
  cupGamesPending: number;
  note: string;
  games: ScheduleGame[];
};

const teams: Record<string, { zh: string; en: string }> = {
  ATL: { zh: '老鹰', en: 'Atlanta Hawks' }, BOS: { zh: '凯尔特人', en: 'Boston Celtics' },
  BKN: { zh: '篮网', en: 'Brooklyn Nets' }, CHA: { zh: '黄蜂', en: 'Charlotte Hornets' },
  CHI: { zh: '公牛', en: 'Chicago Bulls' }, CLE: { zh: '骑士', en: 'Cleveland Cavaliers' },
  DAL: { zh: '独行侠', en: 'Dallas Mavericks' }, DEN: { zh: '掘金', en: 'Denver Nuggets' },
  DET: { zh: '活塞', en: 'Detroit Pistons' }, GSW: { zh: '勇士', en: 'Golden State Warriors' },
  HOU: { zh: '火箭', en: 'Houston Rockets' }, IND: { zh: '步行者', en: 'Indiana Pacers' },
  LAC: { zh: '快船', en: 'LA Clippers' }, LAL: { zh: '湖人', en: 'LA Lakers' },
  MEM: { zh: '灰熊', en: 'Memphis Grizzlies' }, MIA: { zh: '热火', en: 'Miami Heat' },
  MIL: { zh: '雄鹿', en: 'Milwaukee Bucks' }, MIN: { zh: '森林狼', en: 'Minnesota Timberwolves' },
  NOP: { zh: '鹈鹕', en: 'New Orleans Pelicans' }, NYK: { zh: '尼克斯', en: 'New York Knicks' },
  OKC: { zh: '雷霆', en: 'Oklahoma City Thunder' }, ORL: { zh: '魔术', en: 'Orlando Magic' },
  PHI: { zh: '76人', en: 'Philadelphia 76ers' }, PHX: { zh: '太阳', en: 'Phoenix Suns' },
  POR: { zh: '开拓者', en: 'Portland Trail Blazers' }, SAC: { zh: '国王', en: 'Sacramento Kings' },
  SAS: { zh: '马刺', en: 'San Antonio Spurs' }, TOR: { zh: '猛龙', en: 'Toronto Raptors' },
  UTA: { zh: '爵士', en: 'Utah Jazz' }, WAS: { zh: '奇才', en: 'Washington Wizards' },
};

function beijingToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function teamName(code: string, english: boolean) {
  const team = teams[code];
  return team ? (english ? team.en : team.zh) : code;
}

function dateHeading(value: string, english: boolean) {
  return new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date(`${value}T12:00:00+08:00`));
}

export function Schedule202627() {
  const { language } = useLanguage();
  const english = language === 'en';
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [failed, setFailed] = useState(false);
  const [team, setTeam] = useState('all');
  const [month, setMonth] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/nba-schedule-2026-27.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Schedule request failed (${response.status})`);
        return response.json() as Promise<ScheduleData>;
      })
      .then((value) => setSchedule(value))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const months = useMemo(() => [...new Set(schedule?.games.map((game) => game.dateBeijing.slice(0, 7)) ?? [])], [schedule]);
  const filtered = useMemo(() => (schedule?.games ?? []).filter((game) =>
    (team === 'all' || game.away === team || game.home === team) &&
    (month === 'all' || game.dateBeijing.startsWith(month))), [schedule, team, month]);
  const grouped = useMemo(() => {
    const groups = new Map<string, ScheduleGame[]>();
    filtered.forEach((game) => groups.set(game.dateBeijing, [...(groups.get(game.dateBeijing) ?? []), game]));
    return [...groups.entries()];
  }, [filtered]);

  const labels = english ? {
    eyebrow: 'COURTMATCH / SEASON CALENDAR', title: '2026–27 NBA schedule',
    subtitle: 'Every published regular-season matchup, grouped by Beijing date.',
    allTeams: 'All teams', allMonths: 'All months', allGames: 'full season',
    games: 'games', away: 'AWAY', home: 'HOME', neutral: 'NEUTRAL SITE',
    tipoff: 'Beijing tip-off', loading: 'Loading official schedule…', error: 'Schedule could not be loaded. Please try again later.',
    pending: '30 Emirates NBA Cup matchups are pending Group Play results and are not included yet.',
    source: 'Official NBA schedule · snapshot', sourceLink: 'View source PDF', today: beijingToday(),
  } : {
    eyebrow: 'COURTMATCH / 赛季赛程', title: '2026–27 NBA 赛程',
    subtitle: '按北京时间浏览官方已公布的常规赛对阵与开赛时间。',
    allTeams: '全部球队', allMonths: '全部月份', allGames: '全赛季',
    games: '场比赛', away: '客场', home: '主场', neutral: '中立场',
    tipoff: '北京时间开赛', loading: '正在加载官方赛程…', error: '赛程暂时无法加载，请稍后重试。',
    pending: '另有 30 场 NBA 杯赛对阵需等待小组赛结果后确定，当前未纳入列表。',
    source: 'NBA 官方赛程 · 数据截至', sourceLink: '查看官方 PDF', today: beijingToday(),
  };

  return <section className="lab-schedule" aria-labelledby="schedule-title">
    <div className="lab-schedule-heading">
      <div>
        <span className="lab-schedule-eyebrow">{labels.eyebrow} <CalendarDays size={14} /></span>
        <h2 id="schedule-title">{labels.title}</h2>
        <p>{labels.subtitle}</p>
      </div>
      <div className="lab-schedule-total"><strong>{filtered.length.toLocaleString(english ? 'en-US' : 'zh-CN')}</strong><span>{labels.games}</span></div>
    </div>

    <div className="lab-schedule-toolbar">
      <label><span>{english ? 'TEAM' : '球队'}</span><select value={team} onChange={(event) => setTeam(event.target.value)}>
        <option value="all">{labels.allTeams}</option>
        {Object.keys(teams).sort((a, b) => teamName(a, english).localeCompare(teamName(b, english), english ? 'en' : 'zh-CN')).map((code) => <option value={code} key={code}>{teamName(code, english)}</option>)}
      </select></label>
      <label><span>{english ? 'MONTH · BEIJING TIME' : '月份 · 北京时间'}</span><select value={month} onChange={(event) => setMonth(event.target.value)}>
        <option value="all">{labels.allMonths}</option>
        {months.map((value) => <option key={value} value={value}>{new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long' }).format(new Date(`${value}-15T12:00:00+08:00`))}</option>)}
      </select></label>
      <span className="lab-schedule-timezone"><Clock3 size={15} /> {english ? 'All times Asia/Shanghai (UTC+8)' : '全部时间均为北京时间（UTC+8）'}</span>
    </div>

    {schedule && <div className="lab-schedule-notice"><Radio size={16} /><span>{labels.pending}</span></div>}
    {failed && <p className="lab-schedule-state" role="alert">{labels.error}</p>}
    {!schedule && !failed && <p className="lab-schedule-state" role="status">{labels.loading}</p>}
    {schedule && grouped.length === 0 && <p className="lab-schedule-state">{english ? 'No games match these filters.' : '当前筛选条件下没有比赛。'}</p>}
    {schedule && <div className="lab-schedule-days">
      {grouped.map(([date, games]) => <section className="lab-schedule-day" key={date}>
        <header><h3>{dateHeading(date, english)}</h3><span>{games.length} {labels.games}</span></header>
        <div className="lab-schedule-games">
          {games.map((game) => <article className="lab-schedule-game" key={game.id}>
            <time dateTime={`${date}T${game.timeBeijing}:00+08:00`}><strong>{game.timeBeijing}</strong><small>{labels.tipoff}</small></time>
            <div className="lab-schedule-teams">
              <div><span>{labels.away}</span><strong>{teamName(game.away, english)}</strong></div>
              <b aria-hidden="true">@</b>
              <div className={game.venueType === 'home' ? 'is-home' : 'is-neutral'}><span>{game.venueType === 'home' ? labels.home : labels.neutral}</span><strong>{teamName(game.home, english)}</strong></div>
            </div>
            <span className={`lab-schedule-venue ${game.venueType}`}><MapPin size={14} />{game.venueType === 'home' ? `${labels.home} · ${teamName(game.home, english)}` : labels.neutral}</span>
          </article>)}
        </div>
      </section>)}
    </div>}
    {schedule && <footer className="lab-schedule-footer">
      <span>{labels.source} {schedule.sourceAsOf}</span>
      <a href={schedule.sourceUrl} target="_blank" rel="noreferrer">{labels.sourceLink} <ArrowUpRight size={14} /></a>
    </footer>}
  </section>;
}
