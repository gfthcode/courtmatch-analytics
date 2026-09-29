import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Bot, CircleHelp, CornerDownLeft, ExternalLink, MessageSquareText, Send, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { answerScoutQuestion, type ScoutNewsFeed, type ScoutResult } from '../lib/scout';
import { useData } from '../state';
import { useLanguage } from '../i18n';
import './scout-assistant.css';
import './scout-news.css';

type Message = { id: number; role: 'user' | 'assistant'; text: string; result?: ScoutResult };

export function ScoutAssistant() {
  const data = useData();
  const { language } = useLanguage();
  const english = language === 'en';
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [newsFeed, setNewsFeed] = useState<ScoutNewsFeed>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
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
          const articles = Array.isArray(payload.articles) ? payload.articles.filter((article) => article && typeof article.title === 'string' && /^https:\/\//i.test(article.url)) : [];
          if (articles.length) {
            feed = { source: payload.source, updatedAt: payload.updatedAt, articles };
            setNewsFeed(feed);
          }
        }
      }
      const result = answerScoutQuestion(data, prompt, english, feed);
      setMessages((current) => [...current, { id: id + 1, role: 'assistant', text: result.body, result }]);
    } catch {
      const result = answerScoutQuestion(data, prompt, english);
      setMessages((current) => [...current, { id: id + 1, role: 'assistant', text: result.body, result }]);
    } finally {
      setBusy(false);
    }
  };

  const curry = data.players.find((player) => /curry/i.test(player.name));
  const lebron = data.players.find((player) => /lebron/i.test(player.name));
  const celtics = data.teams.find((team) => team.abbreviation === 'BOS');
  const lakers = data.teams.find((team) => team.abbreviation === 'LAL');
  const examples = english
    ? ['Top 5 defensive restrictions', curry ? `Who limits ${curry.shortName} best?` : 'Who limits this scorer best?', curry && lebron ? `Compare ${curry.shortName} vs ${lebron.shortName}` : 'Compare two players head to head', celtics && lakers ? `Compare ${celtics.abbreviation} and ${lakers.abbreviation} team ratings` : 'Compare two teams', 'Latest NBA news']
    : ['防守限制榜前 5', curry ? `谁最能限制${curry.chineseName || curry.shortName}？` : '谁最能限制这名得分手？', curry && lebron ? `比较${curry.chineseName || curry.shortName}和${lebron.chineseName || lebron.shortName}` : '比较两名球员的直接对位', celtics && lakers ? `比较 ${celtics.abbreviation} 和 ${lakers.abbreviation} 球队效率` : '比较两支球队效率', 'NBA 最新新闻'];

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button className="scout-launcher" type="button" aria-label={english ? 'Open CourtMatch Scout' : '打开 CourtMatch Scout'}>
      <Sparkles size={19} strokeWidth={2}/><span>{english ? 'SCOUT' : '数据助手'}</span><i aria-hidden="true"/>
    </button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="scout-overlay"/>
      <Dialog.Content className="scout-panel" aria-describedby="scout-description">
        <header className="scout-header">
          <div className="scout-mark"><Bot size={19}/></div>
          <div className="scout-heading"><p>COURTMATCH · SCOUT</p><Dialog.Title>{english ? 'Matchup analysis assistant' : 'NBA 对位分析助手'}</Dialog.Title></div>
          <Dialog.Close asChild><button className="scout-icon-button" aria-label={english ? 'Close assistant' : '关闭助手'}><X size={19}/></button></Dialog.Close>
          <Dialog.Description id="scout-description" className="scout-sr-only">{english ? 'Ask about player and team matchups, ratings and rankings in the CourtMatch dataset.' : '基于 CourtMatch 数据集查询球员与球队对位、效率和排行榜。'}</Dialog.Description>
        </header>
        <div className="scout-data-note" role="note"><span className={`scout-status-dot ${data.manifest.status === 'stale' ? 'is-stale' : ''}`}/><span>{data.manifest.status === 'stale'
          ? (english ? `Published data · updated ${data.updatedAt.slice(0, 10)} · not live` : `已发布数据 · 更新于 ${data.updatedAt.slice(0, 10)} · 非实时`)
          : (english ? `NBA dataset · updated ${data.updatedAt.slice(0, 10)}` : `NBA 数据集 · 更新于 ${data.updatedAt.slice(0, 10)}`)}</span></div>
        <div className="scout-messages" role="log" aria-live="polite" aria-relevant="additions text">
          {!messages.length ? <section className="scout-welcome">
            <span className="scout-welcome-icon"><Sparkles size={18}/></span>
            <h2>{english ? 'What do you want to find out?' : '今天想看哪组对位？'}</h2>
            <p>{english ? 'Ask about matchups, team ratings, or search the published NBA news feed by player or topic.' : '可以查询球员对位、球队效率，也可以按球员或主题搜索已发布的 NBA 新闻。'}</p>
            <div className="scout-examples">{examples.map((example) => <button type="button" key={example} onClick={() => setQuestion(example)}><MessageSquareText size={14}/>{example}<ArrowUpRight size={13}/></button>)}</div>
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
