export function DrawerOverlay({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <button type="button" className={`drawer-overlay${open ? ' is-open' : ''}`} aria-label="关闭导航遮罩" aria-hidden={!open} tabIndex={open ? 0 : -1} onClick={onClick} />;
}
