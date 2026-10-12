import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, ArrowUpRight, BarChart3, Bot, Bookmark, CircleHelp, CornerDownLeft, ExternalLink, MessageSquareText, Newspaper, Search, Send, Sparkles, UsersRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { answerScoutQuestion, type ScoutNewsFeed, type ScoutResult } from '../lib/scout';
import { readNewsTranslationCache, saveNewsTranslation, translateNewsToChinese } from '../lib/news-translation';
import { buildLineupFitReport, buildWatchlistReport, type FitMetric, type FitWeights } from '../lib/scout-agent';
import { SCOUT_AGENT_OPEN_EVENT, type ScoutAgentMode } from '../lib/scout-events';
import { searchPlayers } from '../lib/api';
import { useData } from '../state';
import { useLanguage } from '../i18n';
import './scout-assistant.css';
import './scout-news.css';

type Message = { id: number; role: 'user' | 'assistant'; text: string; result?: ScoutResult };
const defaultFitWeights: FitWeights = { shooting: 1, playmaking: 1, scoring: 1, rebounding: 1, defense: 1 };
const fitSignals: Array<{ key: FitMetric; zh: string; en: string }> = [
  { key: 'shooting', zh: '三分命中率', en: '3P%' },
  { key: 'playmaking', zh: '助攻', en: 'Assists' },
  { key: 'scoring', zh: '得分', en: 'Scoring' },
  { key: 'rebounding', zh: '篮板', en: 'Rebounding' },
  { key: 'defense', zh: '抢断 + 盖帽', en: 'Steals + blocks' },
];

export function ScoutAssistant() {
  const data = useData();
  const { language } = useLanguage();
  const english = language === 'en';
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [newsFeed, setNewsFeed] = useState<ScoutNewsFeed>();
  const [activeMode, setActiveMode] = useState<ScoutAgentMode | null>(null);
  const [watchSearch, setWatchSearch] = useState('');
  const [fitWeights, setFitWeights] = useState<FitWeights>(defaultFitWeights);
  const [trackedIds, setTrackedIds] = useState<string[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem('cm-agent-watchlist-v1') ?? '[]') as unknown; return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []; }
    catch { return []; }
  });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);
  useEffect(() => {
    const openAgent = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: ScoutAgentMode }>).detail?.mode;
      setActiveMode(mode ?? null);
      setOpen(true);
    };
    window.addEventListener(SCOUT_AGENT_OPEN_EVENT, openAgent);
    return () => window.removeEventListener(SCOUT_AGENT_OPEN_EVENT, openAgent);
  }, []);
  useEffect(() => { try { localStorage.setItem('cm-agent-watchlist-v1', JSON.stringify(trackedIds)); } catch { /* Keep the current session usable when storage is blocked. */ } }, [trackedIds]);

  const requestAnswer = async (prompt: string, mode = activeMode) => {
    if (!prompt || busy) return;
    const id = Date.now();
    setQuestion('');
    setMessages((current) => [...current, { id, role: 'user', text: prompt }]);
    setBusy(true);
    try {
      let feed = newsFeed;
      if (/新闻|消息|报道|场外|赛场外|最新动态|news|headlines?|stories|articles?|off.?court/i.test(prompt) && !feed) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10_000);
        let response: Response;
        try {
          response = await fetch(`${import.meta.env.BASE_URL}data/news.json?_=${Date.now()}`, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
        } finally {
          window.clearTimeout(timeout);
        }
        if (response.ok) {
          const payload = await response.json() as Partial<ScoutNewsFeed>;
          const translations = readNewsTranslationCache();
          const articles = Array.isArray(payload.articles) ? payload.articles.filter((article) => article && typeof article.title === 'string' && /^https:\/\//i.test(article.url)).map((article) => ({ ...article, titleZh: article.titleZh || translations[article.id]?.title, summaryZh: article.summaryZh || translations[article.id]?.summary })) : [];
          if (articles.length) {
            feed = { source: payload.source, updatedAt: payload.updatedAt, articles };
            setNewsFeed(feed);
          }
        }
      }
      let result = mode === 'watchlist'
        ? buildWatchlistReport(data, trackedIds, english)
        : mode === 'lineup'
          ? buildLineupFitReport(data, prompt, english, fitWeights)
          : answerScoutQuestion(data, prompt, english, feed);
      if (!english && mode !== 'watchlist' && mode !== 'lineup' && feed && result.sources?.length) {
        const sourceUrls = new Set(result.sources.map((source) => source.href));
        const matching = feed.articles.filter((article) => sourceUrls.has(article.url) && (!article.titleZh || (article.summary && !article.summaryZh)));
        const translations = new Map<string, { title: string; summary: string }>();
        let cursor = 0;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 12_000);
        try {
          const worker = async () => {
            while (!controller.signal.aborted) {
              const article = matching[cursor++];
              if (!article) return;
              try {
                const translated = await translateNewsToChinese(article.title, article.summary ?? '', controller.signal);
                translations.set(article.id, translated);
                saveNewsTranslation(article.id, translated);
              } catch { /* newsSearch will show a Chinese unavailable notice and keep the source link */ }
            }
          };
          await Promise.all(Array.from({ length: Math.min(3, matching.length) }, () => worker()));
        } finally { window.clearTimeout(timeout); }
        if (translations.size) {
          const translatedFeed = { ...feed, articles: feed.articles.map((article) => ({ ...article, ...(translations.has(article.id) ? { titleZh: translations.get(article.id)!.title, summaryZh: translations.get(article.id)!.summary } : {}) })) };
          result = answerScoutQuestion(data, prompt, english, translatedFeed);
        }
      }
      setMessages((current) => [...current, { id: id + 1, role: 'assistant', text: result.body, result }]);
    } catch {
      const result = mode === 'watchlist'
        ? buildWatchlistReport(data, trackedIds, english)
        : mode === 'lineup'
          ? buildLineupFitReport(data, prompt, english, fitWeights)
          : answerScoutQuestion(data, prompt, english);
      setMessages((current) => [...current, { id: id + 1, role: 'assistant', text: result.body, result }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void requestAnswer(question.trim()); };
  const selectMode = (mode: ScoutAgentMode, prompt: string) => { setActiveMode(mode); setQuestion(prompt); };
  const toggleTrackedPlayer = (playerId: string) => setTrackedIds((current) => current.includes(playerId)
    ? current.filter((id) => id !== playerId)
    : [...current, playerId].slice(-20));

  const curry = data.players.find((player) => /curry/i.test(player.name));
  const lebron = data.players.find((player) => /lebron/i.test(player.name));
  const celtics = data.teams.find((team) => team.abbreviation === 'BOS');
  const lakers = data.teams.find((team) => team.abbreviation === 'LAL');
  const examples = english
    ? ['Lowest opponent scoring in covered matchups', curry ? `Who limits ${curry.shortName} best?` : 'Who limits this scorer best?', curry && lebron ? `Compare ${curry.shortName} vs ${lebron.shortName}` : 'Compare two players head to head', celtics && lakers ? `Compare ${celtics.abbreviation} and ${lakers.abbreviation} team ratings` : 'Compare two teams', 'Latest NBA news']
    : ['样本对手得分最低前 5', curry ? `谁最能限制${curry.chineseName || curry.shortName}？` : '谁最能限制这名得分手？', curry && lebron ? `比较${curry.chineseName || curry.shortName}和${lebron.chineseName || lebron.shortName}` : '比较两名球员的直接对位', celtics && lakers ? `比较 ${celtics.abbreviation} 和 ${lakers.abbreviation} 球队效率` : '比较两支球队效率', 'NBA 最新新闻'];
  const modes: Array<{ id: ScoutAgentMode; title: string; description: string; icon: typeof Activity; prompt: string }> = [
    { id: 'matchup', title: english ? 'Matchup scout' : '对位侦察', description: english ? 'Compare direct matchup samples' : '比较直接对位与样本量', icon: Activity, prompt: curry ? (english ? `Who limits ${curry.shortName} best?` : `谁最能限制${curry.chineseName || curry.shortName}？`) : (english ? 'Find a player’s toughest matchups' : '查询一名球员最难打的对位') },
    { id: 'news', title: english ? 'Daily brief' : '每日新闻简报', description: english ? 'Search published NBA stories' : '检索已发布 NBA 新闻', icon: Newspaper, prompt: english ? 'Latest NBA news' : 'NBA 最新新闻' },
    { id: 'analysis', title: english ? 'Data analyst' : '自然语言分析', description: english ? 'Ask about stats in plain language' : '直接用自然语言提问', icon: BarChart3, prompt: celtics && lakers ? (english ? `Compare ${celtics.abbreviation} and ${lakers.abbreviation} team ratings` : `比较 ${celtics.abbreviation} 和 ${lakers.abbreviation} 球队效率`) : (english ? 'Show the top offensive matchup rankings' : '查看进攻效率排行榜前五') },
    { id: 'watchlist', title: english ? 'Player tracker' : '球员关注与变化', description: english ? 'Save players and review changes' : '本机保存关注球员并查看变化', icon: Bookmark, prompt: english ? 'Create my watchlist change brief' : '生成我的关注球员变化简报' },
    { id: 'lineup', title: english ? 'Lineup fit' : '阵容搭配探索', description: english ? 'Rank candidates by player traits' : '按位置与能力指标筛选候选', icon: UsersRound, prompt: english ? 'Find guards and bigs with shooting and defense' : '寻找具备空间投射和防守能力的后卫与内线' },
  ];
  const trackMatches = watchSearch.trim() ? searchPlayers(data, watchSearch).slice(0, 5) : [];
  const trackedPlayers = trackedIds.map((id) => data.players.find((player) => player.id === id)).filter((player): player is NonNullable<typeof player> => Boolean(player));
  const activeModeInfo = modes.find((mode) => mode.id === activeMode);
  const watchlistPanel = activeMode === 'watchlist' ? <section className="scout-watchlist-panel" aria-label={english ? 'Player watchlist' : '球员关注清单'}>
    <label htmlFor="scout-watch-search">{english ? 'Find a player to follow' : '搜索要关注的球员'}</label>
    <div className="scout-watch-search"><Search size={15}/><input id="scout-watch-search" value={watchSearch} onChange={(event) => setWatchSearch(event.target.value)} placeholder={english ? 'Name, team or abbreviation' : '球员姓名、球队或缩写'} /></div>
    {trackMatches.length > 0 && <div className="scout-watch-matches">{trackMatches.map((player) => <button type="button" key={player.id} onClick={() => toggleTrackedPlayer(player.id)}><span>{player.shortName} · {player.teamAbbreviation}</span><b>{trackedIds.includes(player.id) ? (english ? 'Remove' : '移除') : (english ? '+ Follow' : '+ 关注')}</b></button>)}</div>}
    <div className="scout-watch-chips">{trackedPlayers.length ? trackedPlayers.map((player) => <button type="button" key={player.id} onClick={() => toggleTrackedPlayer(player.id)} title={english ? 'Remove from watchlist' : '从关注清单移除'}>{player.shortName}<X size={11}/></button>) : <span>{english ? 'No players saved yet' : '还没有关注球员'}</span>}</div>
    <small>{english ? 'Saved on this device only · no background alerts' : '仅保存在当前设备 · 不会后台推送提醒'}</small>
    <button className="scout-watch-report" type="button" disabled={!trackedIds.length || busy} onClick={() => void requestAnswer(english ? 'Create my watchlist change brief' : '生成我的关注球员变化简报', 'watchlist')}>{english ? 'Generate change brief' : '生成变化简报'}<ArrowUpRight size={13}/></button>
  </section> : null;
  const lineupPanel = activeMode === 'lineup' ? <section className="scout-fit-panel" aria-label={english ? 'Lineup signal weights' : '阵容筛选指标权重'}>
    <strong>{english ? 'Signal weights' : '指标权重'}</strong>
    <p>{english ? 'Only signals named in your question are ranked. Zero removes a signal.' : '仅计算问题中提及的指标；设为 0 可排除。'}</p>
    <div className="scout-fit-signals">{fitSignals.map(({ key, zh, en }) => <label key={key}>
      <span>{english ? en : zh}</span>
      <input type="range" min="0" max="3" step="0.5" value={fitWeights[key]} onChange={(event) => setFitWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} />
      <output>{fitWeights[key].toFixed(1)}×</output>
    </label>)}</div>
  </section> : null;

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button className="scout-launcher" type="button" aria-label={english ? 'Open CourtMatch Agent' : '打开 CourtMatch Agent'}>
      <Sparkles size={19} strokeWidth={2}/><span>{english ? 'NBA AGENT' : 'NBA Agent'}</span><i aria-hidden="true"/>
    </button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="scout-overlay"/>
      <Dialog.Content className="scout-panel" aria-describedby="scout-description">
        <header className="scout-header">
          <div className="scout-mark"><Bot size={19}/></div>
          <div className="scout-heading"><p>COURTMATCH · AGENT</p><Dialog.Title>{english ? 'NBA data agent' : 'NBA 数据 Agent'}</Dialog.Title></div>
          <Dialog.Close asChild><button className="scout-icon-button" aria-label={english ? 'Close assistant' : '关闭助手'}><X size={19}/></button></Dialog.Close>
          <Dialog.Description id="scout-description" className="scout-sr-only">{english ? 'Ask about player and team matchups, ratings and rankings in the CourtMatch dataset.' : '基于 CourtMatch 数据集查询球员与球队对位、效率和排行榜。'}</Dialog.Description>
        </header>
        <div className="scout-data-note" role="note"><span className={`scout-status-dot ${data.manifest.status === 'stale' ? 'is-stale' : ''}`}/><span>{english
          ? `${data.manifest.season || data.seasons[0] || 'NBA'} stats · ${data.manifest.status === 'stale' ? 'stale snapshot' : 'published snapshot'} · last game ${data.manifest.nbaStatsDataThrough || 'unverified'}`
          : `${data.manifest.season || data.seasons[0] || 'NBA'} 数据 · ${data.manifest.status === 'stale' ? '过期快照' : '已发布快照'} · 比赛记录截止 ${data.manifest.nbaStatsDataThrough || '未核验'}`}</span></div>
        <div className="scout-mode-strip" role="group" aria-label={english ? 'Choose an agent workflow' : '选择 Agent 工作流'}>{modes.map(({ id: mode, title, icon: Icon, prompt }) => <button type="button" key={mode} aria-pressed={activeMode === mode} onClick={() => selectMode(mode, prompt)}><Icon size={14}/><span>{title}</span></button>)}</div>
        <div className="scout-messages" role="log" aria-live="polite" aria-relevant="additions text">
          {watchlistPanel}
          {lineupPanel}
          {!messages.length ? <section className="scout-welcome">
            <span className="scout-welcome-icon"><Sparkles size={18}/></span>
            <h2>{activeModeInfo?.title ?? (english ? 'What do you want the Agent to do?' : '选择一个 Agent 任务')}</h2>
            <p>{activeModeInfo?.description ?? (english ? 'Choose a focused workflow. Results use CourtMatch’s published NBA data and link back to the relevant page.' : '选择一个具体工作流。结果基于 CourtMatch 已发布的 NBA 数据，并可跳回对应分析页面。')}</p>
            {!activeMode && <div className="scout-tool-grid">{modes.map(({ id: mode, title, description, icon: Icon, prompt }) => <button type="button" key={mode} onClick={() => selectMode(mode, prompt)}><Icon size={16}/><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={13}/></button>)}</div>}
            {!activeMode && <div className="scout-examples">{examples.map((example) => <button type="button" key={example} onClick={() => { setActiveMode('analysis'); setQuestion(example); }}><MessageSquareText size={14}/>{example}<ArrowUpRight size={13}/></button>)}</div>}
          </section> : messages.map((message) => <article className={`scout-message scout-message-${message.role}`} key={message.id}>
            <div className="scout-message-avatar" aria-hidden="true">{message.role === 'assistant' ? <Sparkles size={14}/> : <span>YOU</span>}</div>
            <div className="scout-message-content">{message.role === 'assistant' && <strong className="scout-result-title">{message.result?.title}</strong>}<p>{message.text}</p>{message.result?.sources?.map((source) => <a className="scout-result-link scout-source-link" key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={13}/></a>)}{message.result?.action && <Link className="scout-result-link" to={message.result.action.href} onClick={() => setOpen(false)}>{message.result.action.label}<ArrowUpRight size={14}/></Link>}</div>
          </article>)}
          {busy && <div className="scout-thinking" role="status"><span/><span/><span/>{english ? (/news|headlines?|stories|articles?|off.?court/i.test(messages.at(-1)?.text ?? '') ? 'Searching the published NBA news feed…' : 'Checking the published data…') : (/新闻|消息|报道|场外|赛场外|最新动态/.test(messages.at(-1)?.text ?? '') ? '正在检索已发布的 NBA 新闻…' : '正在查询已发布数据…')}</div>}
          <div ref={endRef}/>
        </div>
        <footer className="scout-footer">
          {!messages.length && <div className="scout-capability"><CircleHelp size={13}/>{english ? 'Read-only assistant · published stats and ESPN news feed · no predictions' : '只读助手 · 已发布数据与 ESPN 新闻源 · 不提供比赛预测'}</div>}
          <form className="scout-form" onSubmit={submit}>
            <label className="scout-sr-only" htmlFor="scout-question">{english ? 'Ask a basketball data question' : '输入 NBA 数据问题'}</label>
            <input id="scout-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={280} placeholder={english ? 'Ask about a player or matchup…' : '问一名球员或一组对位…'} autoComplete="off" />
            <button type="submit" aria-label={english ? 'Send question' : '发送问题'} disabled={!question.trim() || busy}><Send size={17}/></button>
          </form>
          <p className="scout-form-hint"><CornerDownLeft size={12}/>{english ? 'Enter to send · answers are based on published data' : '按 Enter 发送 · 回答基于已发布数据'}</p>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
