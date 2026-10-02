import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
  '主导航': 'Main navigation', '跳转到主要内容': 'Skip to main content', '数据口径': 'Data methodology', '实时数据': 'Live data', '数据质量警告': 'Data quality warning', '演示数据': 'Demo data',
  '筛选条件': 'Filters', '调整赛季、视角与样本范围': 'Adjust season, perspective and sample', '基础筛选': 'Basic filters', '赛季': 'Season', '比赛类型': 'Season type', '球队': 'Team', '所有球队': 'All teams', '球员': 'Player', '对位筛选': 'Matchup filters', '视角': 'Perspective', '进攻视角': 'Offense', '防守视角': 'Defense', '对手球队': 'Opponent team', '所有对手': 'All opponents', '锁定对手': 'Lock opponent', '不限球员': 'All players', '取消锁定': 'Unlock opponent', '样本筛选': 'Sample filters', '位置': 'Position', '全部位置': 'All positions', '样本质量': 'Sample quality', '全部样本': 'All samples', '清除全部筛选': 'Clear all filters', '头像大小': 'Avatar size', '小': 'Small', '中': 'Medium', '大': 'Large',
  '复制链接': 'Copy link', '链接已复制，可还原当前筛选': 'Link copied with current filters', '请复制链接：': 'Copy this link: ', '导出 CSV': 'Export CSV', 'CSV 已导出，包含当前全部筛选结果。': 'CSV exported with all current filtered results.', '导出 PNG': 'Export PNG', 'PNG 分享卡片已生成。': 'PNG share card generated.', '图片生成失败，请重试。': 'Image export failed. Please try again.', '结果分页': 'Result pagination', '条结果 · 第': ' results · Page ', '页': '', '上一页': 'Previous', '下一页': 'Next', '条结果小于 25 回合。Small sample. Interpret with caution. ': ' results have fewer than 25 possessions. Small sample; interpret with caution. ', '样本等级仅表示回合数量；阵容、协防和赛程都会影响结果。': 'Sample tiers describe possession count only; lineups, help defense and schedule also affect results.',
  '每回合得分': 'Points per possession', '颜色表示相对效率强度；数字仍为实际值': 'Color indicates relative efficiency; the number remains the actual value', '对比联盟': 'vs league', '暂无符合条件的对位': 'No matchups found', '尝试降低最低回合数或清除筛选条件。': 'Lower the minimum possessions or clear filters.',
  '最高进攻对位效率': 'Best offensive matchup efficiency', '最低被防效率': 'Lowest opponent efficiency allowed', '最多对位回合': 'Most matchup possessions', '最强防守压制': 'Strongest defensive restriction', '最大效率提升': 'Largest efficiency improvement', '最大效率下降': 'Largest efficiency decline', '最稳定球员': 'Most consistent players', '联盟排行榜': 'League rankings', '搜索球员 / 球队': 'Search players / teams', '例如 Curry / GSW': 'e.g. Curry / GSW', '榜单类别': 'Ranking metric', '低于 50 回合的球员不会在默认榜单中领先高样本球员；如手动调低门槛，结果会保留 Small sample 提示。': 'The default 50-possession threshold prevents low-sample players from leading. Lowering it keeps a Small sample warning.', '当前：降序': 'Sort: descending', '当前：升序': 'Sort: ascending', '排名': 'Rank', '进攻 /100': 'Offense /100', '被攻 /100': 'Opponent /100', '相对均值': 'vs average', '当前指标': 'Selected metric', '样本': 'Sample', '更新': 'Updated', '当前条件下没有合格球员': 'No qualified players match these filters', '使用默认 50 回合门槛': 'Use the default 50-possession threshold',
  '未找到这位球员': 'Player not found', '请从联盟对位或全局搜索选择球员。': 'Choose a player from Matchups or global search.', '去联盟对位': 'Go to Matchups', '左侧球员': 'Player on the left', '右侧球员': 'Player on the right', '已选择': 'Selected', '等待选择': 'Waiting for selection', '球队筛选': 'Filter by team', '支持姓名、中文名、缩写和球队搜索；共 ': 'Search names, Chinese names, abbreviations or teams; ', ' 位可选球员。': ' players available.', '清除': 'Clear', '交换左右球员': 'Swap players', '交换左右': 'Swap sides', '清除比较': 'Clear comparison', '再选择一名球员': 'Choose one more player', '先选择两名球员': 'Choose two players', ' 已准备好，请在右侧选择对手。': ' is ready. Choose an opponent on the right.', '左右两侧分别选择一名球员后，页面会自动展示双向对位结果。': 'Choose a player on each side to compare their head-to-head results.', '常规赛': 'Regular season', '季后赛': 'Playoffs', '每 100 对位回合得分': 'Points per 100 matchup possessions', '可比较': 'Comparable', '谨慎': 'Use caution', '最低门槛 ': 'Minimum threshold: ', ' 回合': ' possessions', '联盟平均': 'League average', '数据更新时间': 'Data updated',
  '当前数据状态：': 'Current data status: ', '已验证 Live NBA 数据': 'Verified live NBA data', '来源标记': 'Source label', '覆盖范围': 'Coverage', '更新时间': 'Last updated', '发布门禁': 'Publishing checks', '查看当前数据模式': 'View current data mode', '指标与方法论': 'Metrics & methodology', '数据来源与覆盖范围': 'Data sources & coverage', '清楚标注数据状态、来源边界和接入方式。': 'Clearly document data status, source boundaries and access methods.', '先看口径，再看结论；每个核心指标都可追溯。': 'Understand the definitions before the conclusions; every core metric is traceable.', '核心定义': 'Core definitions', '每100回合得分': 'Points per 100 possessions', '机会效率': 'Opportunity efficiency', '样本等级': 'Sample tiers', '解读边界': 'Interpretation limits', '查看数据来源': 'View data sources', '设置与数据状态': 'Settings & data status', '偏好保存在本机浏览器；不会上传个人数据。': 'Preferences are stored in this browser and are not uploaded.', '外观': 'Appearance', '主题': 'Theme', '跟随系统': 'Follow system', '深色球馆': 'Dark arena', '浅色阅读': 'Light reading', '数据模式': 'Data mode', '强制使用内置演示数据': 'Always use built-in demo data', '演示数据永远明确标注，适合产品体验与本地测试。': 'Demo data is always labeled and intended for product previews and local testing.', '连接状态测试': 'Connection status test', '此开关只用于验证错误态与重试路径。': 'This switch only tests error and retry states.', '模拟数据连接错误': 'Simulate a data connection error',
  '对手': 'Opponent', '得分': 'Points', '失误': 'Turnovers', '较均值 %': 'vs average %', '搜索对手': 'Search opponents', '显示模式': 'Display mode', '展开球员列表': 'Open player directory', '数据指标说明': 'Metric notes', 'NBA官网 ↗': 'NBA.com ↗', '锁定对手后，图表、摘要和表格只保留所选球员与该对手的直接匹配记录。': 'Locking an opponent limits charts, summaries and tables to direct matchups with that player.', '回合来自公开追踪数据中的直接匹配记录，不等同于整场上场时间或完整防守回合。': 'Possessions are direct-matchup records from public tracking data. They are not total playing time or all defensive possessions.', '每100回合得分使用得分 ÷ 对位回合；样本质量只按回合数量分级，不代表统计置信度。': 'Points per 100 uses points ÷ matchup possessions. Sample tiers reflect possession count, not statistical confidence.', '筛选、指标和图表均已就绪': 'Filters, metrics and charts are ready', '正在完成交互图表渲染': 'Finishing interactive chart rendering', '正在检查当前筛选结果': 'Checking the current filtered results', '读取筛选条件': 'Read filters', '定位球员档案': 'Find player profile', '聚合对位记录': 'Aggregate matchup records', '计算核心指标': 'Calculate core metrics', '绘制交互图表': 'Render interactive chart', '球员对位详情': 'Player matchup detail', '选择球员与视角，让图表和表格一起回答你的问题。': 'Choose a player and perspective to explore the matchup through charts and tables.', '取消框选': 'Clear selection', '显示列': 'Visible columns', '排序指标': 'Sort metric', '降序': 'Descending', '升序': 'Ascending', '没有可显示的记录': 'No records to display', '清除筛选': 'Clear filters', '如何阅读这组对位': 'How to read this matchup', '估算进攻机会效率：': 'Estimated offensive opportunity efficiency: ', '分/次，使用 PTS ÷ (FGA + 0.44 × FTA + TOV)。': ' points/attempt using PTS ÷ (FGA + 0.44 × FTA + TOV).', '比较双方互相防守': 'Compare both players defending each other',
};
Object.assign(translations, {
  '球队数据': 'Team data', '联盟散点': 'League scatter', '球队攻防': 'Team offense & defense', '球队打法与攻防': 'Team play types & efficiency', '球队对比': 'Team comparison', '薪金仓库': 'Salary vault', '未来展望': 'Roadmap', '攻防影响': 'Offensive & defensive impact', '球员国家': 'Player origins', '自动更新与数据质量': 'Automatic updates & data quality', '指标与方法论': 'Metrics & methodology', '数据来源与覆盖范围': 'Data sources & coverage', '球员数据': 'Player data', '查看 NBA 球队目录与已发布的球队统计入口；球队数据只显示当前数据集真实覆盖范围。': 'Browse NBA teams and published team-stat entry points. Only verified coverage in the current dataset is shown.', '清楚标注数据状态、来源边界和接入方式。': 'Clearly document data status, source boundaries and access methods.', '先看口径，再看结论；每个核心指标都可追溯。': 'Understand the definitions before the conclusions; every core metric is traceable.', '选择球队': 'Select team', '比赛节奏': 'Pace', '进攻效率': 'Offensive efficiency', '防守效率': 'Defensive efficiency', '查看球队详情 →': 'View team details →', '没有匹配的球队': 'No teams match your search', '请使用球队名称或缩写搜索。': 'Search by team name or abbreviation.', '当前赛季没有已验证的球队统计快照': 'No verified team-stat snapshot is available for this season', '球队球员': 'Team players', '打开球员目录 →': 'Open player directory →', '查看详情 →': 'View details →', '球员展望': 'Player outlook', '球员国家字段不可用': 'Player origin data is unavailable', '未映射报告': 'Unmapped players', 'NBA Stats': 'NBA Stats', 'Player profile': 'Player profile',
});

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (text: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try { return localStorage.getItem('cm-language') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; }
  });
  const setLanguage = useCallback((next: Language) => { setLanguageState(next); try { localStorage.setItem('cm-language', next); } catch { /* keep session-only */ } }, []);
  useEffect(() => {
    const syncLanguage = (event: StorageEvent) => {
      if (event.key !== 'cm-language') return;
      setLanguageState(event.newValue === 'en' ? 'en' : 'zh');
    };
    window.addEventListener('storage', syncLanguage);
    return () => window.removeEventListener('storage', syncLanguage);
  }, []);
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => language === 'en' ? (translations[text] ?? text) : text }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('Language context missing');
  return value;
}
