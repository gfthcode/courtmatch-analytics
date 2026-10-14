import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, ChevronDown, CircleDollarSign, Home, Rocket, Shield, UsersRound } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n';
import './module-navigation.css';

type Destination = { label: string; href: string; detail: string };
type Module = { label: string; href: string; icon: typeof UsersRound; links: Destination[] };

const modules: Module[] = [
  { label: '球员数据', href: '/players', icon: UsersRound, links: [
    { label: '球员总览', href: '/players', detail: '赛季基础与高阶数据表' },
    { label: '球员比较', href: '/comparison', detail: '并排比较球员表现' },
    { label: '进攻打法', href: '/playtypes', detail: '查看 Synergy 进攻方式' },
    { label: '每日最佳', href: '/daily', detail: '按比赛日期浏览球员表现' },
    { label: '新闻', href: '/news', detail: '浏览场内外新闻与中文摘要' },
    { label: '球员国家', href: '/country', detail: '查看已核验的球员来源字段' },
  ] },
  { label: '球队数据', href: '/teams', icon: Shield, links: [
    { label: '球队目录', href: '/teams', detail: '搜索球队并进入球队档案' },
    { label: '联盟散点', href: '/team', detail: '浏览球队效率分布' },
    { label: '球队攻防与打法', href: '/team/pk', detail: '切换进攻、防守与回合类型' },
    { label: '球队对比', href: '/team/compare', detail: '对照两支球队的已发布指标' },
    { label: '排行榜', href: '/rankings', detail: '按指标与样本门槛筛选' },
  ] },
  { label: '对位杀手', href: '/matchups', icon: Activity, links: [
    { label: '联盟对位', href: '/matchups', detail: '筛选直接攻防对位记录' },
    { label: '球员对位', href: '/matchup/player', detail: '查看单名球员的对位样本' },
    { label: '球员比较', href: '/comparison', detail: '比较两名球员的攻防结果' },
    { label: '对位效率榜', href: '/rankings', detail: '按每 100 对位回合排序' },
  ] },
  { label: '薪金仓库', href: '/salary', icon: CircleDollarSign, links: [
    { label: '薪资总览', href: '/salary', detail: '查看薪资字段接入状态' },
    { label: '计划接入字段', href: '/salary#salary-fields', detail: '查看球员、合同与球队薪资字段' },
    { label: '来源核验', href: '/salary#salary-sources', detail: '查看来源与接入条件' },
  ] },
  { label: '未来展望', href: '/future', icon: Rocket, links: [
    { label: '路线图', href: '/future', detail: '查看已完成、计划与产品边界' },
    { label: '自动更新与数据质量', href: '/changelog', detail: '查看数据新鲜度和发布检查' },
    { label: '方法论', href: '/methodology', detail: '阅读指标定义与样本说明' },
    { label: '数据来源', href: '/sources', detail: '追溯来源、日期与覆盖范围' },
    { label: '数据状态设置', href: '/settings', detail: '调整显示与语言偏好' },
  ] },
  { label: '攻防影响', href: '/impact', icon: BarChart3, links: [
    { label: '攻防影响总览', href: '/impact', detail: '并列查看进攻、防守与差值' },
    { label: '攻防效率榜', href: '/rankings?metric=edge', detail: '按当前数据覆盖查看效率差' },
    { label: '球队防守方式', href: '/team/pk', detail: '查看球队进攻与防守打法' },
    { label: '球员防守对位', href: '/matchup?perspective=defense', detail: '从防守方角度检查对位' },
  ] },
  { label: '主页板块', href: '/', icon: Home, links: [
    { label: '首页精选对位', href: '/#home-matchups', detail: '查看首页精选直接对位' },
    { label: '联盟效率领跑者', href: '/#home-leaders', detail: '查看进攻效率排名' },
    { label: '攻防影响摘要', href: '/impact', detail: '并列查看进攻、防守与差值' },
    { label: '全部分析入口', href: '/matchups', detail: '打开完整对位分析工作台' },
    { label: 'NBA 新闻', href: '/news', detail: '浏览场内外新闻与中文摘要' },
  ] },
];

export function ModuleNavigation() {
  const [openModule, setOpenModule] = useState<string | null>(null);
  const { language, t } = useLanguage();
  const location = useLocation();

  useEffect(() => setOpenModule(null), [location.pathname, location.search, location.hash]);
  useEffect(() => {
    if (!openModule) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.module-nav')) setOpenModule(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenModule(null); };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [openModule]);

  return <nav className="module-nav" aria-label={t('主导航')}>
    {modules.map((module) => {
      const Icon = module.icon;
      const active = module.href === '/' ? location.pathname === '/' : location.pathname === module.href || module.links.some((link) => location.pathname === link.href.split('?')[0] || location.pathname.startsWith(`${link.href.split('?')[0]}/`));
      return <div className={`module-nav-group${active ? ' is-active' : ''}${openModule === module.label ? ' is-open' : ''}`} key={module.label}>
        <NavLink className="module-nav-primary" to={module.href} end={module.href === '/'}>{t(module.label)}</NavLink>
        <button className="module-nav-trigger" type="button" aria-label={`${t(module.label)}${language === 'en' ? ' options' : '功能菜单'}`} aria-expanded={openModule === module.label} onClick={() => setOpenModule(openModule === module.label ? null : module.label)}><ChevronDown size={13} /></button>
        {openModule === module.label && <div className="module-nav-panel"><div className="module-nav-panel-heading"><span><Icon size={16} />{t(module.label)}</span><small>{language === 'en' ? 'CHOOSE A MODULE' : '选择功能入口'}</small></div><div className="module-nav-links">{module.links.map((link) => <Link key={link.href + link.label} to={link.href} onClick={() => setOpenModule(null)}><span><strong>{t(link.label)}</strong><small>{t(link.detail)}</small></span><ArrowUpRight size={15} /></Link>)}</div></div>}
      </div>;
    })}
  </nav>;
}
