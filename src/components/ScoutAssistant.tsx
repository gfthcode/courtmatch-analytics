import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, ArrowDown, ArrowUpRight, BarChart3, Bot, Bookmark, Check, Copy, ExternalLink, Languages, Maximize2, Minimize2, Newspaper, Plus, RotateCcw, Search, Send, SlidersHorizontal, Sparkles, Square, UsersRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { answerScoutQuestion, type ScoutNewsFeed, type ScoutResult } from '../lib/scout';
import { buildLineupFitReport, buildWatchlistReport, type FitMetric, type FitWeights } from '../lib/scout-agent';
import { getScoutFollowUps, resolveScoutTurn } from '../lib/scout-conversation';
import { loadScoutNews, translateScoutNews } from '../lib/scout-news-client';
import { readScoutSession, saveScoutSession, selectScoutWorkflow, SCOUT_TURN_LIMIT, type ScoutTurn } from '../lib/scout-session';
import { consumePendingScoutOpen, SCOUT_AGENT_OPEN_EVENT, type ScoutAgentMode } from '../lib/scout-events';
import { searchPlayers } from '../lib/api';
import { useData } from '../state';
import { useLanguage } from '../i18n';
import './scout-assistant.css';

const defaultFitWeights: FitWeights = { shooting: 1, playmaking: 1, scoring: 1, rebounding: 1, defense: 1 };
const fitSignals: Array<{ key: FitMetric; zh: string; en: string }> = [
  { key: 'shooting', zh: '三分投射', en: 'Three-point shooting' }, { key: 'playmaking', zh: '传球组织', en: 'Playmaking' },
  { key: 'scoring', zh: '得分', en: 'Scoring' }, { key: 'rebounding', zh: '篮板', en: 'Rebounding' }, { key: 'defense', zh: '抢断 + 盖帽', en: 'Steals + blocks' },
];
const presets: Array<{ zh: string; en: string; weights: FitWeights }> = [
  { zh: '均衡', en: 'Balanced', weights: defaultFitWeights },
  { zh: '空间与防守', en: 'Shooting + defense', weights: { shooting: 3, playmaking: 0.5, scoring: 1, rebounding: 1, defense: 3 } },
  { zh: '持球核心', en: 'Lead creator', weights: { shooting: 1.5, playmaking: 3, scoring: 3, rebounding: 0.5, defense: 0.5 } },
];

function AnswerBody({ result, english }: { result: ScoutResult; english: boolean }) {
  return <>
    <h3 className="scout-result-title">{result.title}</h3>
    <div className="scout-answer-text">{result.body.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => {
      const sourceStart = paragraph.search(/(?:^|\n)(?:数据口径：|来源：|Source:)/);
      const main = sourceStart < 0 ? paragraph : paragraph.slice(0, sourceStart);
      const note = sourceStart < 0 ? '' : paragraph.slice(sourceStart).trim();
      return <div key={index} className="scout-answer-section">{main && <p>{main}</p>}{note && <details className="scout-source-note"><summary>{english ? 'Source, coverage & date' : '数据来源、范围与日期'}</summary><p>{note}</p></details>}</div>;
    })}</div>
    {Boolean(result.sources?.length) && <details className="scout-sources"><summary>{english ? `Original sources (${result.sources!.length})` : `查看新闻原文（${result.sources!.length}）`}</summary>{result.sources!.map((source, index) => <a key={`${source.href}-${index}`} href={source.href} target="_blank" rel="noopener noreferrer">{index + 1}. {source.label}<ExternalLink size={13}/></a>)}</details>}
  </>;
}

export function ScoutAssistant() {
  const data = useData();
  const { language, setLanguage } = useLanguage();
  const english = language === 'en';
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ScoutTurn[]>(() => readScoutSession());
  const [busy, setBusy] = useState<'data' | 'news' | 'translation' | null>(null);
  const [activeMode, setActiveMode] = useState<ScoutAgentMode | null>(null);
  const [watchSearch, setWatchSearch] = useState('');
  const [fitWeights, setFitWeights] = useState<FitWeights>(defaultFitWeights);
  const [showControls, setShowControls] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [trackedIds, setTrackedIds] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem('cm-agent-watchlist-v1') ?? '[]'); return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === 'string'))].slice(0, 20) : []; }
    catch { return []; }
  });
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const requestRef = useRef<{ id: string; controller: AbortController } | null>(null);
  const lastTurn = turns.at(-1);
  const lastContext = useMemo(() => lastTurn && !['lineup', 'watchlist'].includes(lastTurn.mode)
    ? resolveScoutTurn(data, lastTurn.resolvedQuery).context : undefined, [data, lastTurn]);
  const suggestions = useMemo(() => lastContext ? getScoutFollowUps(data, lastContext, english) : [], [data, lastContext, english]);

  useEffect(() => { saveScoutSession(turns); }, [turns]);
  useEffect(() => { try { localStorage.setItem('cm-agent-watchlist-v1', JSON.stringify(trackedIds)); } catch { /* Keep the session usable without storage. */ } }, [trackedIds]);
  useEffect(() => { if (open && stickRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [turns, busy, open]);
  useEffect(() => {
    if (open && showControls && (activeMode === 'watchlist' || activeMode === 'lineup') && scrollRef.current) {
      scrollRef.current.scrollTop = 0; stickRef.current = false; setAtBottom(false);
    }
  }, [activeMode, showControls, open]);
  useEffect(() => () => { requestRef.current?.controller.abort(); }, []);
  useEffect(() => {
    const openAgent = (event: Event) => { const mode = (consumePendingScoutOpen() ?? (event as CustomEvent<{ mode?: ScoutAgentMode }>).detail)?.mode; setActiveMode(mode ?? null); setShowControls(true); setOpen(true); };
    window.addEventListener(SCOUT_AGENT_OPEN_EVENT, openAgent);
    const pending = consumePendingScoutOpen();
    if (pending) { setActiveMode(pending.mode ?? null); setShowControls(true); setOpen(true); }
    return () => window.removeEventListener(SCOUT_AGENT_OPEN_EVENT, openAgent);
  }, []);

  const stopRequest = () => {
    const request = requestRef.current; if (!request) return;
    request.controller.abort(); requestRef.current = null; setBusy(null);
    setTurns((current) => current.map((turn) => turn.id === request.id ? { ...turn, status: turn.answers ? 'complete' : 'cancelled' } : turn));
  };
  const changeOpen = (next: boolean) => { if (!next) stopRequest(); setOpen(next); };
  const scrollToLatest = () => { stickRef.current = true; setAtBottom(true); if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; };
  const newConversation = () => {
    stopRequest(); setTurns([]); setQuestion(''); setActiveMode(null); setShowControls(true); setNotice(''); stickRef.current = true; setAtBottom(true); composerRef.current?.focus();
  };
  const createAnswer = (turn: ScoutTurn, en: boolean, feed?: ScoutNewsFeed): ScoutResult => turn.mode === 'watchlist'
    ? buildWatchlistReport(data, turn.trackedIds ?? trackedIds, en, { query: turn.resolvedQuery })
    : turn.mode === 'lineup' ? buildLineupFitReport(data, turn.resolvedQuery, en, turn.weights ?? fitWeights) : answerScoutQuestion(data, turn.resolvedQuery, en, feed);

  const runTurn = async (turn: ScoutTurn, forceNews = false) => {
    if (requestRef.current) return;
    const controller = new AbortController(); requestRef.current = { id: turn.id, controller };
    const currentRequest = () => requestRef.current?.controller === controller && !controller.signal.aborted;
    const publish = (feed?: ScoutNewsFeed, cachedNews = false) => {
      if (!currentRequest()) return;
      const answers = { zh: createAnswer(turn, false, feed), en: createAnswer(turn, true, feed) };
      setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, answers, cachedNews, refreshFailed: false, status: 'complete' } : item));
    };
    setBusy(turn.mode === 'news' ? 'news' : 'data'); setNotice('');
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (!currentRequest()) return;
      if (turn.mode === 'news') {
        const loaded = await loadScoutNews({ signal: controller.signal, force: forceNews });
        if (!currentRequest()) return;
        publish(loaded.feed, loaded.refreshFailed);
        const result = createAnswer(turn, false, loaded.feed);
        if (result.sources?.length) {
          setBusy('translation');
          const translated = await translateScoutNews(loaded.feed, result.sources.map((source) => source.href), controller.signal, (feed) => publish(feed, loaded.refreshFailed));
          if (!currentRequest()) return;
          publish(translated, loaded.refreshFailed);
        }
      } else publish();
    } catch {
      if (!currentRequest()) return;
      setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, refreshFailed: Boolean(item.answers), status: item.answers ? 'complete' : 'error' } : item));
    } finally { if (requestRef.current?.controller === controller) { requestRef.current = null; setBusy(null); } }
  };
  const requestAnswer = (prompt: string, requestedMode = activeMode) => {
    const clean = prompt.trim().slice(0, 500); if (!clean) return;
    if (requestRef.current) { if (busy === 'translation') stopRequest(); else return; }
    const explicit = resolveScoutTurn(data, clean).context;
    const mode = selectScoutWorkflow(clean, requestedMode, Boolean(explicit.playerIds.length || explicit.teamIds.length));
    const resolved = resolveScoutTurn(data, clean, ['lineup', 'watchlist'].includes(mode) ? undefined : lastContext);
    const turn: ScoutTurn = { id: crypto.randomUUID(), prompt: clean, resolvedQuery: ['lineup', 'watchlist'].includes(mode) ? clean : resolved.resolvedQuery,
      mode, createdAt: new Date().toISOString(), status: 'pending', usedContext: resolved.usedContext,
      ...(mode === 'lineup' ? { weights: { ...fitWeights } } : {}), ...(mode === 'watchlist' ? { trackedIds: [...trackedIds] } : {}) };
    setQuestion(''); setActiveMode(mode); setShowControls(false); stickRef.current = true; setAtBottom(true);
    setTurns((current) => [...current, turn].slice(-SCOUT_TURN_LIMIT));
    void runTurn(turn, mode === 'news' && /刷新|更新|重新|refresh|update/i.test(clean));
  };
  const retryTurn = (turn: ScoutTurn) => {
    if (requestRef.current) return;
    setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, refreshFailed: false, status: 'pending' } : item)); void runTurn(turn, turn.mode === 'news');
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); requestAnswer(question); };
  const selectMode = (mode: ScoutAgentMode | null, prompt = '') => { stopRequest(); setActiveMode(mode); setQuestion(prompt); setShowControls(true); composerRef.current?.focus(); };
  const copyAnswer = async (turn: ScoutTurn) => {
    const result = turn.answers?.[language]; if (!result) return;
    try { await navigator.clipboard.writeText(`${turn.prompt}\n\n${result.title}\n${result.body}${result.sources?.length ? '\n\n' + result.sources.map((source) => `${source.label}: ${source.href}`).join('\n') : ''}`); setCopiedId(turn.id); setNotice(''); }
    catch { setNotice(english ? 'Copy was unavailable. Select the answer text to copy it.' : '暂时无法自动复制，可以选中回答文字复制。'); }
  };
  const toggleTrackedPlayer = (playerId: string) => setTrackedIds((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : current.length >= 20 ? current : [...current, playerId]);

  const modes: Array<{ id: ScoutAgentMode; title: string; description: string; icon: typeof Activity; prompt: string }> = [
    { id: 'matchup', title: english ? 'Matchups' : '对位侦察', description: english ? 'Explore head-to-head samples' : '看谁与谁直接交手、样本有多大', icon: Activity, prompt: english ? 'Who limits Stephen Curry in direct matchups?' : '谁最能限制库里？至少 50 回合' },
    { id: 'news', title: english ? 'NBA news' : '新闻简报', description: english ? 'Headlines, context and original sources' : '中文标题与摘要，附新闻原文', icon: Newspaper, prompt: english ? 'Latest NBA news' : 'NBA 最新新闻' },
    { id: 'analysis', title: english ? 'Data analysis' : '数据分析', description: english ? 'Season stats, comparisons and recent form' : '赛季数据、球员比较与近期表现', icon: BarChart3, prompt: english ? 'Compare Stephen Curry and LeBron James season stats' : '比较库里和詹姆斯的赛季数据' },
    { id: 'watchlist', title: english ? 'Watchlist' : '关注球员', description: english ? 'Follow up to 20 players on this device' : '本机保存关注名单，查看近况变化', icon: Bookmark, prompt: english ? 'Create my watchlist change brief' : '生成我的关注球员变化简报' },
    { id: 'lineup', title: english ? 'Lineup fit' : '阵容搭配', description: english ? 'Find candidates by role and weighted skills' : '按位置、样本和能力筛选候选', icon: UsersRound, prompt: english ? 'Find bigs with shooting and defense' : '寻找具备投射和防守能力的内线' },
  ];
  const examples = english ? ['Top 5 scorers', 'Stephen Curry last 5 games', 'Compare Celtics and Lakers team ratings'] : ['得分榜前 5 名', '库里最近 5 场表现', '比较凯尔特人和湖人的球队效率'];
  const playersById = useMemo(() => new Map(data.players.map((player) => [player.id, player])), [data.players]);
  const trackMatches = useMemo(() => watchSearch.trim() ? searchPlayers(data, watchSearch).slice(0, 6) : [], [data, watchSearch]);
  const trackedPlayers = trackedIds.map((id) => playersById.get(id)).filter((player): player is NonNullable<typeof player> => Boolean(player));
  const activeModeInfo = modes.find((mode) => mode.id === activeMode);
  const isDemo = data.manifest.isDemo || data.mode === 'demo';
  const statsStatus = isDemo ? (english ? 'Demo data' : '演示数据') : data.manifest.status === 'stale' ? (english ? 'Historical snapshot' : '历史快照') : (english ? 'Published snapshot' : '已发布快照');

  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><button className="scout-launcher" type="button" aria-label={english ? 'Open CourtMatch Agent' : '打开 CourtMatch Agent'}><Sparkles size={19}/><span>NBA Agent</span></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="scout-overlay"/>
      <Dialog.Content className={`scout-panel${expanded ? ' is-expanded' : ''}`} aria-describedby="scout-description" onOpenAutoFocus={(event) => { event.preventDefault(); composerRef.current?.focus(); }}>
        <header className="scout-header"><div className="scout-mark"><Bot size={21}/></div><div className="scout-heading"><p>COURTMATCH · SCOUT</p><Dialog.Title>{english ? 'Your NBA research desk' : '你的 NBA 研究助手'}</Dialog.Title></div>
          <button type="button" className="scout-icon-button" title={english ? 'Switch to Chinese' : '切换到英文'} aria-label={english ? 'Switch to Chinese' : '切换到英文'} onClick={() => setLanguage(english ? 'zh' : 'en')}><Languages size={17}/></button>
          <button type="button" className="scout-icon-button scout-expand" title={english ? 'Toggle expanded view' : '切换宽屏阅读'} aria-label={english ? 'Toggle expanded view' : '切换宽屏阅读'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button>
          <Dialog.Close asChild><button type="button" className="scout-icon-button" aria-label={english ? 'Close assistant' : '关闭助手'}><X size={20}/></button></Dialog.Close>
          <Dialog.Description id="scout-description" className="scout-sr-only">{english ? 'Research NBA stats, matchups and news. Ask follow-up questions. Recent conversations are saved on this device.' : '查询 NBA 数据、对位与新闻，支持连续追问。最近对话仅保存在当前设备。'}</Dialog.Description>
        </header>
        <div className="scout-data-note"><span className={`scout-status-dot${data.manifest.status === 'stale' || isDemo ? ' is-stale' : ''}`}/><span>{statsStatus} · {data.manifest.season || data.seasons[0]}{data.manifest.nbaStatsDataThrough ? ` · ${english ? 'Games through' : '比赛截至'} ${data.manifest.nbaStatsDataThrough}` : ''}</span><Link to="/sources" onClick={() => changeOpen(false)}>{english ? 'Details' : '详情'}<ArrowUpRight size={11}/></Link></div>
        <div className="scout-mode-strip" role="group" aria-label={english ? 'Choose a task' : '选择任务'}><button type="button" aria-pressed={!activeMode} onClick={() => selectMode(null)}><Sparkles size={14}/>{english ? 'Auto' : '自由提问'}</button>{modes.map(({ id, title, icon: Icon, prompt }) => <button type="button" key={id} aria-pressed={activeMode === id} onClick={() => selectMode(id, prompt)}><Icon size={14}/>{title}</button>)}</div>
        <div className="scout-toolbar"><span>{english ? 'Saved on this device · latest 12 questions' : '对话保存在本机 · 保留最近 12 轮'}</span><button type="button" onClick={newConversation}><Plus size={13}/>{english ? 'New chat' : '新对话'}</button></div>
        <div className="scout-messages" ref={scrollRef} onScroll={() => { const el = scrollRef.current; if (!el) return; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 70; stickRef.current = near; setAtBottom(near); }}>
          {['watchlist', 'lineup'].includes(activeMode ?? '') && <section className="scout-controls"><button className="scout-controls-toggle" type="button" aria-expanded={showControls} onClick={() => setShowControls(!showControls)}><SlidersHorizontal size={15}/>{activeMode === 'lineup' ? (english ? 'Candidate preferences' : '候选筛选偏好') : (english ? `Watchlist (${trackedPlayers.length}/20)` : `关注清单（${trackedPlayers.length}/20）`)}<span>{showControls ? '−' : '+'}</span></button>
            {showControls && activeMode === 'watchlist' && <div className="scout-watchlist-panel"><label htmlFor="scout-watch-search">{english ? 'Find a player to follow' : '搜索要关注的球员'}</label><div className="scout-watch-search"><Search size={15}/><input id="scout-watch-search" value={watchSearch} onChange={(event) => setWatchSearch(event.target.value)} placeholder={english ? 'Player name or team' : '球员姓名或球队'}/></div>
              {watchSearch.trim() && !trackMatches.length && <small>{english ? 'No matching player. Try a full name.' : '没有匹配球员，请尝试完整姓名。'}</small>}
              <div className="scout-watch-matches">{trackMatches.map((player) => <button type="button" key={player.id} disabled={trackedIds.length >= 20 && !trackedIds.includes(player.id)} onClick={() => toggleTrackedPlayer(player.id)}><span>{player.shortName} · {player.teamAbbreviation}</span><b>{trackedIds.includes(player.id) ? (english ? 'Remove' : '移除') : (english ? '+ Follow' : '+ 关注')}</b></button>)}</div>
              <div className="scout-watch-chips">{trackedPlayers.length ? trackedPlayers.map((player) => <button type="button" key={player.id} onClick={() => toggleTrackedPlayer(player.id)} aria-label={`${english ? 'Unfollow' : '取消关注'} ${player.shortName}`}>{player.shortName}<X size={12}/></button>) : <small>{english ? 'Add your first player above.' : '在上方添加第一位关注球员。'}</small>}</div><small>{english ? 'No background notifications. Up to 20 players.' : '最多关注 20 人，不会后台推送通知。'}</small>
              <button className="scout-primary-button" type="button" disabled={!trackedPlayers.length || Boolean(busy)} onClick={() => requestAnswer(english ? 'Create my watchlist change brief' : '生成我的关注球员变化简报', 'watchlist')}>{english ? 'Generate change brief' : '生成变化简报'}<ArrowUpRight size={14}/></button>
            </div>}
            {showControls && activeMode === 'lineup' && <div className="scout-fit-panel"><p>{english ? 'Set priorities, then ask for a role. Only signals named in your question enter the score; zero excludes a signal.' : '调整偏好后提问所需位置。只计算问题中提及的指标；设为 0 可排除。'}</p><div className="scout-presets">{presets.map((preset) => <button type="button" key={preset.en} onClick={() => setFitWeights({ ...preset.weights })}>{english ? preset.en : preset.zh}</button>)}</div>
              <div className="scout-fit-signals">{fitSignals.map(({ key, zh, en }) => <label key={key}><span>{english ? en : zh}</span><input type="range" min="0" max="3" step="0.5" value={fitWeights[key]} onChange={(event) => setFitWeights((current) => ({ ...current, [key]: Number(event.target.value) }))}/><output>{fitWeights[key].toFixed(1)}×</output></label>)}</div>
              {lastTurn?.mode === 'lineup' && <button className="scout-primary-button" type="button" disabled={Boolean(busy)} onClick={() => requestAnswer(lastTurn.resolvedQuery, 'lineup')}>{english ? 'Rerun with these weights' : '按当前权重重新筛选'}</button>}
            </div>}
          </section>}
          {!turns.length && <section className="scout-welcome"><span className="scout-eyebrow">{english ? 'FROM A QUESTION TO THE EVIDENCE' : '从一个问题，找到数据依据'}</span><h2>{activeModeInfo?.title ?? (english ? 'What would you like to explore?' : '今天想研究谁？')}</h2><p>{activeModeInfo?.description ?? (english ? 'Compare players, explore recent form or catch up on the news. Follow up naturally as you go.' : '比较球员、追踪近况、了解新闻。问完一个问题，还可以接着问。')}</p>
            {!activeMode && <div className="scout-tool-grid">{modes.map(({ id, title, description, icon: Icon, prompt }) => <button type="button" key={id} onClick={() => selectMode(id, prompt)}><Icon size={19}/><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={14}/></button>)}</div>}
            <div className="scout-examples">{(activeModeInfo ? [activeModeInfo.prompt] : examples).map((example) => <button type="button" key={example} disabled={Boolean(busy)} onClick={() => requestAnswer(example)}>{example}<ArrowUpRight size={13}/></button>)}</div>
          </section>}
          <div role="log" aria-live="polite" aria-relevant="additions text" aria-busy={Boolean(busy)}>{turns.map((turn) => {
            const result = turn.answers?.[language];
            return <section className="scout-turn" key={turn.id}><div className="scout-question-bubble"><span>{english ? 'YOU' : '你'}</span><p>{turn.prompt}</p></div><article className="scout-answer" aria-label={english ? 'Agent answer' : '助手回答'}>
              <div className="scout-answer-heading"><span><Sparkles size={14}/> COURTMATCH</span><time dateTime={turn.createdAt}>{new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(turn.createdAt))}</time></div>
              {turn.usedContext && <details className="scout-context"><summary>{english ? 'Using your previous question' : '已结合前文理解'}</summary><p>{turn.resolvedQuery}</p></details>}
              {result && <AnswerBody result={result} english={english}/>}{turn.cachedNews && <p className="scout-inline-notice">{english ? 'Refresh failed; showing the last saved news feed.' : '刷新暂未成功，正在显示上次保存的新闻。'}</p>}
              {turn.refreshFailed && <p className="scout-inline-notice" role="status">{english ? 'Retry failed; the previous answer is shown. Try again later.' : '重查未成功，当前保留的是上次回答，可稍后重试。'}</p>}
              {!result && <p className="scout-empty-answer">{turn.status === 'error' ? (english ? 'This request could not finish. Retry or ask another question.' : '这次查询暂未完成，可以重试或继续问其他问题。') : turn.status === 'cancelled' ? (english ? 'Stopped. You can retry or ask a new question.' : '已停止，可以重试或直接问新问题。') : (english ? 'Checking your question…' : '正在查询你的问题…')}</p>}
              {turn.status !== 'pending' && <div className="scout-answer-actions">{result?.action && <Link to={result.action.href} onClick={() => changeOpen(false)}>{result.action.label}<ArrowUpRight size={13}/></Link>}<span/>{result && <button type="button" onClick={() => void copyAnswer(turn)} aria-label={english ? 'Copy answer' : '复制回答'}>{copiedId === turn.id ? <Check size={13}/> : <Copy size={13}/>}<span>{copiedId === turn.id ? (english ? 'Copied' : '已复制') : (english ? 'Copy' : '复制')}</span></button>}<button type="button" disabled={Boolean(busy)} onClick={() => retryTurn(turn)} aria-label={english ? 'Refresh this answer' : '重新查询这条回答'}><RotateCcw size={13}/><span>{english ? 'Retry' : '重查'}</span></button></div>}
            </article></section>;
          })}</div>
          {busy && <div className="scout-thinking" role="status"><i/><span>{busy === 'translation' ? (english ? 'Preparing the Chinese version… you can stop at any time.' : '正在补充中文翻译…可以随时停止。') : busy === 'news' ? (english ? 'Fetching the latest published news…' : '正在读取最新发布的新闻…') : (english ? 'Checking published data…' : '正在核对已发布数据…')}</span></div>}
          {!busy && lastTurn?.status === 'complete' && suggestions.length > 0 && <div className="scout-followups" aria-label={english ? 'Suggested follow-up questions' : '继续追问'}><span>{english ? 'Keep exploring' : '继续追问'}</span>{suggestions.slice(0, 3).map((suggestion) => <button type="button" key={suggestion.query} onClick={() => requestAnswer(suggestion.query, 'analysis')}>{suggestion.label}<ArrowUpRight size={12}/></button>)}</div>}
        </div>
        {!atBottom && turns.length > 0 && <button type="button" className="scout-latest" onClick={scrollToLatest}><ArrowDown size={13}/>{english ? 'Latest answer' : '回到最新回答'}</button>}
        <footer className="scout-footer">{notice && <p className="scout-inline-notice" role="status">{notice}</p>}<form className="scout-form" onSubmit={submit}><label className="scout-sr-only" htmlFor="scout-question">{english ? 'Ask an NBA question' : '输入 NBA 问题'}</label>
          <textarea ref={composerRef} id="scout-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy || busy === 'translation') requestAnswer(question); } }} maxLength={500} rows={2} placeholder={english ? 'Ask a question, or follow up: “What about his last 5 games?”' : '输入问题，或接着问：他最近 5 场呢？'}/>
          {busy && <button type="button" className="scout-stop" onClick={stopRequest} aria-label={english ? 'Stop request' : '停止查询'} title={english ? 'Stop request' : '停止查询'}><Square size={16}/></button>}
          {(!busy || busy === 'translation') && <button type="submit" aria-label={english ? 'Send question' : '发送问题'} disabled={!question.trim()}><Send size={18}/></button>}
        </form><div className="scout-form-hint"><span>{english ? 'Enter sends · Shift + Enter adds a line' : 'Enter 发送 · Shift + Enter 换行'}</span><span>{question.length}/500</span></div></footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
