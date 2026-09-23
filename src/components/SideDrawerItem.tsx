import { ArrowUpRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export function SideDrawerItem({ index, label, description, href, icon, onNavigate }: { index: string; label: string; description?: string; href: string; icon: ReactNode; onNavigate: () => void }) {
  return <NavLink to={href} end={href === '/'} className={({ isActive }) => `side-drawer-item${isActive ? ' is-active' : ''}`} onClick={onNavigate}><span className="side-drawer-index">{index}</span><span className="side-drawer-icon">{icon}</span><span className="side-drawer-copy"><strong>{label}</strong>{description && <small>{description}</small>}</span><ArrowUpRight className="side-drawer-arrow" size={16} /></NavLink>;
}
