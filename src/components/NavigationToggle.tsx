import { Menu } from 'lucide-react';
import { Button } from './ui/button';

export function NavigationToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <Button variant="ghost" className="navigation-toggle" aria-label={open ? '关闭导航' : '打开导航'} aria-expanded={open} aria-controls="courtmatch-side-drawer" onClick={onClick}><Menu size={19} /></Button>;
}
