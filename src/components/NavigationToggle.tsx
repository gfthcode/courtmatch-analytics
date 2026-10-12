import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../i18n';

export function NavigationToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useLanguage();

  return <Button variant="ghost" className="navigation-toggle" aria-label={t(open ? '关闭导航' : '打开导航')} aria-expanded={open} aria-controls="courtmatch-side-drawer" onClick={onClick}>
    <Menu size={19} aria-hidden="true" />
    <span className="navigation-toggle-label">{t(open ? '关闭' : '导航')}</span>
  </Button>;
}
