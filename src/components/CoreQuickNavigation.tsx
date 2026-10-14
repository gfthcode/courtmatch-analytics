import { Activity, BarChart3, Home, Newspaper, UsersRound, UserRoundSearch } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../i18n';
import './core-quick-navigation.css';

const shortcuts = [
  { label: '首页', href: '/', icon: Home },
  { label: '联盟对位', href: '/matchups', icon: Activity },
  { label: '球员总览', href: '/players', icon: UserRoundSearch },
  { label: '球员比较', href: '/comparison', icon: UsersRound },
  { label: '排行榜', href: '/rankings', icon: BarChart3 },
  { label: '新闻', href: '/news', icon: Newspaper },
];

export function CoreQuickNavigation() {
  const { language, t } = useLanguage();

  return <nav className="core-quick-nav core-quick-nav--top" aria-label={language === 'en' ? 'Core features' : '核心功能快捷入口'}>
    <span className="core-quick-nav-label">{language === 'en' ? 'CORE' : '核心功能'}</span>
    <div className="core-quick-nav-links">
      {shortcuts.map(({ label, href, icon: Icon }) => <NavLink
        key={href}
        to={href}
        end={href === '/'}
        className={({ isActive }) => `core-quick-nav-link${isActive ? ' is-active' : ''}`}
      >
        <Icon size={15} aria-hidden="true" />
        <span>{t(label)}</span>
      </NavLink>)}
    </div>
  </nav>;
}
