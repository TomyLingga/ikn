'use client';

import Icon from '@/components/Icon';
import styles from './SidebarToggle.module.css';

interface SidebarToggleProps {
  expanded: boolean;
  onClick: () => void;
  openLabel?: string;
  closeLabel?: string;
  className?: string;
}

export default function SidebarToggle({
  expanded,
  onClick,
  openLabel = 'Buka menu',
  closeLabel = 'Tutup menu',
  className = '',
}: SidebarToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${className}`}
      aria-label={expanded ? closeLabel : openLabel}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <Icon name={expanded ? 'close' : 'menu'} size={18} />
    </button>
  );
}
