import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Language = 'zh' | 'en';

const translations: Record<string, string> = {
  '首页': 'Home', '联盟对位': 'Matchups', '球员比较': 'Player Comparison', '排行榜': 'Rankings', '打法类型': 'Play Types', '新闻': 'News', '方法论': 'Methodology', 'NBA 直接对位分析': 'NBA Matchup Analytics',
  '打开导航': 'Open navigation', '关闭导航': 'Close navigation', '切换主题': 'Toggle theme', '全局搜索': 'Global search', 'CourtMatch 首页': 'CourtMatch home',
  '找到你的球员': 'Find your player', '关闭搜索': 'Close search', '搜索球员': 'Search players', '搜索球员或球队': 'Search players or teams',
  '打开全局球员搜索': 'Open global player search', '支持中英文姓名、球队、缩写；↑ ↓ 选择，Enter 打开球员详情。': 'Search by name, team or abbreviation; use ↑ ↓ and Enter to open a player.',
  '支持中英文姓名、球队、简称与键盘选择。': 'Search names, teams or abbreviations with keyboard navigation.',
  '从一名球员开始': 'Start with a player', '读懂每一次': 'Read every', '正面对位。': 'head-to-head matchup.',
  '热门直接对位': 'Hot matchups', '进入分析工作台': 'Open analysis workspace', '表现进入视野': 'League leaders', 'View all rankings': 'View all rankings',
  '进攻影响力': 'Offensive impact', '防守限制力': 'Defensive impact', '查看完整榜单': 'View full rankings', '阅读方法论': 'Read methodology',
  '数字需要上下文。': 'Numbers need context.', '样本量不等于因果关系。先理解口径，再使用结论。': 'Sample size is not causality. Understand the methodology before drawing conclusions.',
  '当前赛季': 'Current season', '覆盖球员': 'Players covered', '对位记录': 'Matchup records', '联盟平均效率': 'League average efficiency',
  '常规赛分析口径': 'Regular-season scope', 'NBA 球员目录': 'NBA player directory', '可筛选直接对位': 'Filterable direct matchups', '当前覆盖数据加权值': 'Weighted value across current data',
  '联盟效率领跑者': 'League leaders', '首页分析工作台': 'Home analysis workspace',
  '当前数据摘要': 'Current data summary', '最近更新': 'Recent data update', '查看数据来源与覆盖范围': 'View data sources and coverage',
  '数据来源': 'Data sources', '指标口径': 'Metric definitions', '设置': 'Settings', '对位': 'Matchups', '比较': 'Compare', '榜单': 'Rankings',
  'NBA 数据实验室': 'NBA data lab', '数据入口': 'Data modules', '分析与产品': 'Analysis & product', '打开相关分析模块': 'Open related analysis module', '进入分析页面': 'Open analysis page',
  '球员数据': 'Player data', '球队数据': 'Team data', '对位杀手': 'Matchup lab', '薪金仓库': 'Salary vault', '未来展望': 'Future outlook',
  '球员总览': 'Player overview', '球队对比': 'Team comparison', '联盟散点': 'League scatter', '球队攻防': 'Team offense & defense', '赛季涨幅': 'Season trends',
  '球员对位': 'Player matchup', '薪资总览': 'Salary overview', '球员页面': 'Player page', '球员对比': 'Player comparison',
  '球员展望': 'Player outlook', '攻防影响': 'Impact', '每日最佳': 'Daily leaders', '球员国家': 'Player countries', '更新日志': 'Changelog', '数据状态': 'Data status',
  '支持 CourtMatch': 'Support CourtMatch', '反馈与建议': 'Feedback & suggestions', '社交媒体': 'Social media', '按 Escape 关闭导航': 'Press Escape to close navigation',
  '每日更新 NBA 球员场内外动态': 'Daily on-court and off-court NBA player news',
  'NBA 官方公开数据': 'Official NBA public data', '发布层：GitHub JSON': 'Published via GitHub JSON', '仅用于产品演示，不代表官方 NBA 追踪数据。': 'Product demo only; not official NBA tracking data.',
  '用直接对位数据，看清谁在攻防回合中真正占据上风。': 'Use direct matchup data to see who gains the edge on offense and defense.',
  '搜索球员，开始探索': 'Search players to explore', '比较两名球员': 'Compare players', '进攻方每 100 对位回合得分': 'Points per 100 offensive matchup possessions', '进入这组对位': 'Explore this matchup', '暂无精选对位': 'No featured matchup available',
  '球员 → 视角 → 样本 → 对位': 'Player → Perspective → Sample → Matchup', '打开分析工作台': 'Open analysis workspace', '每一组对位，都有细节。': 'Every matchup has a story.', '从样本量充足的记录切入，再看效率差异。': 'Start with matchup records that meet the sample threshold, then compare efficiency.',
  '全部对位': 'All matchups', '精选对位': 'Featured matchup', '进攻面对': 'OFFENSE VS', '每 100 回合得分': 'Points per 100 possessions', '相对数据集均值': 'vs dataset average', '查看对位详情': 'View matchup details',
  '让表现': 'Put performance', '进入视野。': 'in focus.', '基于同一赛季、同一口径的对位回合加权汇总。': 'Weighted matchup totals using one season and one consistent definition.',
  '进攻效率领先': 'Top offensive efficiency', '防守限制领先': 'Best defensive restriction', '对位回合领先': 'Most matchup possessions', '效率提升领先': 'Largest efficiency improvement', '效率下降最多': 'Largest efficiency decline',
  '进入排行榜': 'View rankings', '进攻对位效率': 'Offensive matchup efficiency', '防守限制效率': 'Defensive matchup efficiency', '对位样本回合': 'Matchup possessions', '每 100 个进攻对位回合得分，数值越高越好。': 'Points scored per 100 offensive matchup possessions; higher is better.', '对手每 100 个进攻对位回合得分，数值越低越好。': 'Opponent points per 100 offensive matchup possessions; lower is better.', '统计该球员作为进攻方或防守方的对位回合总量。': 'Total matchup possessions recorded for the player on offense and defense.',
  '进攻效率': 'Offense', '防守限制': 'Defense', '对位回合': 'Possessions', '选择榜单指标': 'Choose ranking metric', '点击球员打开画像。': 'Select a player to open their profile.', '点击球员打开画像': 'Select a player to open their profile', '每 100 回合': 'Per 100 possessions', '暂无数据': 'No data available',
  '每一项效率都附带样本回合和比较基准。样本多不代表因果关系，了解算法后再做判断。': 'Efficiency metrics include sample size and a comparison baseline. A larger sample does not prove causation; review the methodology before drawing conclusions.',
  '重试': 'Retry', '使用演示数据': 'Use demo data', '暂时无法读取数据': 'Data is temporarily unavailable', '正在整理对位数据…': 'Preparing matchup data…',
  '探索联盟对位': 'Explore matchups', '这个页面没有出现在赛程里': 'This page is not on the schedule', '检查链接，或返回联盟对位重新开始。': 'Check the link, or return to matchups to start again.',
};

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (text: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try { return localStorage.getItem('cm-language') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; }
  });
  const setLanguage = (next: Language) => { setLanguageState(next); try { localStorage.setItem('cm-language', next); } catch { /* keep session-only */ } };
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => language === 'en' ? (translations[text] ?? text) : text }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('Language context missing');
  return value;
}
