import { useMemo, useState } from 'react';
import { Download, Plus, RotateCcw, Save, Trash2, WalletCards } from 'lucide-react';
import { useLanguage } from '../i18n';

type Season = '2025-26' | '2026-27';
type SalaryRow = { id: string; name: string; amount: string; kind: 'salary' | 'hold' };
type SavedSheet = { teamName: string; season: Season; rows: SalaryRow[] };
const STORAGE_KEY = 'courtmatch-salary-sheet-v1';
const CAP: Record<Season, { cap: number; minimum: number; tax: number; apron1: number; apron2: number; updated: string }> = {
  '2025-26': { cap: 154_647_000, minimum: 139_182_000, tax: 187_895_000, apron1: 195_945_000, apron2: 207_824_000, updated: '2025-06-30' },
  '2026-27': { cap: 164_961_000, minimum: 148_465_000, tax: 200_428_000, apron1: 209_015_000, apron2: 221_686_000, updated: '2026-06-30' },
};
const dollars = (value: number, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const blankRow = (): SalaryRow => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', amount: '', kind: 'salary' });
function isSalaryRow(value: unknown): value is SalaryRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<SalaryRow>;
  return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.amount === 'string' && (row.kind === 'salary' || row.kind === 'hold');
}
function readSavedSheet(): SavedSheet | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SavedSheet> | null;
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    const rows = parsed.rows.filter(isSalaryRow);
    return { teamName: typeof parsed.teamName === 'string' ? parsed.teamName : '', season: parsed.season === '2025-26' ? '2025-26' : '2026-27', rows: rows.length ? rows : [blankRow(), blankRow(), blankRow()] };
  } catch { return null; }
}

export function SalaryVault() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [initialSheet] = useState(readSavedSheet);
  const [season, setSeason] = useState<Season>(initialSheet?.season ?? '2026-27');
  const [teamName, setTeamName] = useState(initialSheet?.teamName ?? '');
  const [rows, setRows] = useState<SalaryRow[]>(initialSheet?.rows ?? [blankRow(), blankRow(), blankRow()]);
  const [saved, setSaved] = useState(false);
  const cap = CAP[season];
  const validRows = useMemo(() => rows.filter((row) => row.name.trim() && Number.isFinite(Number(row.amount)) && Number(row.amount) > 0), [rows]);
  const amount = useMemo(() => validRows.reduce((sum, row) => sum + Number(row.amount), 0), [validRows]);
  const hasValidRows = validRows.length > 0;
  const room = cap.cap - amount;
  const updateRow = (id: string, patch: Partial<SalaryRow>) => { setSaved(false); setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)); };

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ teamName, rows, season } satisfies SavedSheet)); setSaved(true); }
    catch { setSaved(false); }
  };
  const exportCsv = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [['Name', 'Type', 'Salary USD'], ...validRows.map((row) => [row.name, row.kind, String(Number(row.amount))])].map((line) => line.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const safeTeamName = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'salary-sheet';
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `courtmatch-${safeTeamName}-${season}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reset = () => { setTeamName(''); setRows([blankRow(), blankRow(), blankRow()]); setSaved(false); try { localStorage.removeItem(STORAGE_KEY); } catch { /* local storage may be unavailable */ } };
  const t = (zh: string, english: string) => en ? english : zh;
  const metrics = [
    { label: t('工资帽空间', 'Cap room'), value: hasValidRows ? dollars(Math.abs(room), en ? 'en-US' : 'zh-CN') : '—', note: hasValidRows ? (room >= 0 ? t('低于工资帽', 'below the cap') : t('超出工资帽', 'over the cap')) : t('录入薪资后计算', 'Enter salary to calculate'), tone: !hasValidRows ? 'neutral' : room >= 0 ? 'positive' : 'negative' },
    { label: t('最低球队薪资差额', 'Minimum team salary gap'), value: hasValidRows ? dollars(Math.abs(cap.minimum - amount), en ? 'en-US' : 'zh-CN') : '—', note: hasValidRows ? (amount >= cap.minimum ? t('已达到最低门槛', 'minimum threshold reached') : t('距离最低门槛', 'remaining to minimum')) : t('录入薪资后计算', 'Enter salary to calculate'), tone: !hasValidRows ? 'neutral' : amount >= cap.minimum ? 'positive' : 'negative' },
    { label: t('奢侈税线', 'Tax line'), value: hasValidRows ? dollars(Math.abs(cap.tax - amount), en ? 'en-US' : 'zh-CN') : '—', note: hasValidRows ? (cap.tax >= amount ? t('距离税线', 'below the tax line') : t('超出税线', 'over the tax line')) : t('录入薪资后计算', 'Enter salary to calculate'), tone: !hasValidRows ? 'neutral' : cap.tax >= amount ? 'positive' : 'negative' },
    { label: t('第一土豪线', 'First apron'), value: hasValidRows ? dollars(Math.abs(cap.apron1 - amount), en ? 'en-US' : 'zh-CN') : '—', note: hasValidRows ? (cap.apron1 >= amount ? t('距离第一土豪线', 'below first apron') : t('超出第一土豪线', 'over first apron')) : t('录入薪资后计算', 'Enter salary to calculate'), tone: !hasValidRows ? 'neutral' : cap.apron1 >= amount ? 'positive' : 'negative' },
    { label: t('第二土豪线', 'Second apron'), value: hasValidRows ? dollars(Math.abs(cap.apron2 - amount), en ? 'en-US' : 'zh-CN') : '—', note: hasValidRows ? (cap.apron2 >= amount ? t('距离第二土豪线', 'below second apron') : t('超出第二土豪线', 'over second apron')) : t('录入薪资后计算', 'Enter salary to calculate'), tone: !hasValidRows ? 'neutral' : cap.apron2 >= amount ? 'positive' : 'negative' },
  ];

  return <section className="salary-workbench" aria-labelledby="salary-workbench-title">
    <header className="salary-workbench-head">
      <div><span className="eyebrow">CAP SPACE WORKBENCH</span><h2 id="salary-workbench-title"><WalletCards size={24} />{t('球队薪金空间计算器', 'Team cap-space calculator')}</h2><p>{t('输入球员薪资与 cap hold，快速查看球队工资帽、奢侈税线和土豪线位置。', 'Enter player salaries and cap holds to see your position against the cap, tax line and aprons.')}</p></div>
      <label className="salary-season-picker"><span>{t('赛季', 'Season')}</span><select value={season} onChange={(event) => setSeason(event.target.value as Season)}><option value="2026-27">2026-27</option><option value="2025-26">2025-26</option></select></label>
    </header>
    <div className="salary-cap-benchmark"><span>{t('联盟官方门槛', 'Official league thresholds')} · {season}</span><b>{t('工资帽', 'Cap')} {dollars(cap.cap, en ? 'en-US' : 'zh-CN')}</b><b>{t('最低球队薪资', 'Minimum team salary')} {dollars(cap.minimum, en ? 'en-US' : 'zh-CN')}</b><b>{t('奢侈税线', 'Tax line')} {dollars(cap.tax, en ? 'en-US' : 'zh-CN')}</b><small>{t('NBA 官方公布', 'Published by NBA')} · {cap.updated} · <a href={season === '2026-27' ? 'https://www.nba.com/news/nba-salary-cap-2026-27-season' : 'https://pr.nba.com/nba-salary-cap-2025-26-season/'} target="_blank" rel="noreferrer">{t('查看公告 ↗', 'View release ↗')}</a></small></div>
    <div className="salary-workbench-fields"><label className="field"><span>{t('球队名称（自定义）', 'Team name (custom)')}</span><input value={teamName} onChange={(event) => { setTeamName(event.target.value); setSaved(false); }} placeholder={t('例如：Boston Celtics', 'e.g. Boston Celtics')} /></label><div className="salary-total"><small>{t('已录入工资总额', 'Entered team salary')} · {validRows.length} {t('条有效记录', 'valid rows')}</small><strong>{dollars(amount, en ? 'en-US' : 'zh-CN')}</strong></div></div>
    <div className="salary-calculated-grid">{metrics.map((metric) => <article className={`salary-calculated-card ${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</div>
    <div className="salary-sheet-title"><div><h3>{t('工资表输入', 'Cap sheet inputs')}</h3><p>{t('金额按美元/赛季年薪填写；空白行不会计入。', 'Enter annual salary in USD; blank rows are excluded.')}</p></div><div className="salary-sheet-actions"><button type="button" onClick={() => { setRows((current) => [...current, blankRow()]); setSaved(false); }}><Plus size={15} />{t('添加薪资行', 'Add salary row')}</button><button type="button" onClick={save}><Save size={15} />{saved ? t('已保存', 'Saved') : t('保存到本机', 'Save locally')}</button><button type="button" onClick={exportCsv}><Download size={15} />CSV</button><button type="button" onClick={reset} aria-label={t('清空工资表', 'Clear cap sheet')}><RotateCcw size={15} /></button></div></div>
    <div className="salary-sheet-table"><div className="salary-sheet-row salary-sheet-header"><span>{t('球员 / 项目', 'Player / item')}</span><span>{t('类型', 'Type')}</span><span>{t('赛季金额（美元）', 'Annual amount (USD)')}</span><span /></div>{rows.map((row) => <div className="salary-sheet-row" key={row.id}><input aria-label={t('球员或项目名称', 'Player or item name')} value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} placeholder={t('球员姓名或 cap hold', 'Player name or cap hold')} /><select aria-label={t('薪资类型', 'Salary type')} value={row.kind} onChange={(event) => updateRow(row.id, { kind: event.target.value as SalaryRow['kind'] })}><option value="salary">{t('球员薪资', 'Player salary')}</option><option value="hold">Cap hold</option></select><input aria-label={t('美元年薪', 'Annual salary in USD')} type="number" min="0" step="1000" inputMode="decimal" value={row.amount} onChange={(event) => updateRow(row.id, { amount: event.target.value })} placeholder="0" /><button type="button" className="salary-remove-row" aria-label={t('删除此行', 'Remove row')} onClick={() => { setRows((current) => current.filter((item) => item.id !== row.id)); setSaved(false); }}><Trash2 size={16} /></button></div>)}</div>
    <aside className="salary-calculator-caveat"><strong>{t('使用边界', 'Important limits')}</strong><p>{t('工资帽门槛来自 NBA 官方公告；工资表内容由你手动输入，仅保存在当前浏览器，不会上传。此工具是初步空间估算，不会自动计入鸟权 cap hold、底薪名额占位、奖金、交易匹配、例外条款或 CBA 触发限制，因此不能替代球队正式工资帽账本。', 'Cap thresholds come from NBA releases. Cap-sheet figures are user-entered and stored only in this browser. This is a planning estimate: it does not automatically model Bird-rights holds, incomplete-roster charges, bonuses, trade matching, exceptions or CBA triggers, and is not an official team ledger.')}</p></aside>
  </section>;
}
