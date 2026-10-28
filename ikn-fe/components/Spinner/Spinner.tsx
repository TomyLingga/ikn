// Ikon loading halus: cincin SVG bergradasi warna merek yang berputar + busur yang memanjang-memendek.
// <Spinner /> saja = ikon 22px; <Spinner label="Memuat order…" /> = ikon + teks berjajar; `block` = ditumpuk di tengah
// (untuk kotak kosong/placeholder). Menghormati prefers-reduced-motion (busur statis, tetap berputar pelan).
import { useId } from 'react';

interface SpinnerProps {
  size?: number;
  label?: string;
  block?: boolean;
  className?: string;
}

export default function Spinner({ size = 22, label, block = false, className = '' }: SpinnerProps) {
  const grad = `spin-grad-${useId().replace(/:/g, '')}`; // id gradien unik: beberapa spinner bisa tampil sekaligus
  const icon = (
    <svg className="spin-ring" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent, var(--primary))" />
        </linearGradient>
      </defs>
      <circle className="spin-track" cx="24" cy="24" r="19" fill="none" strokeWidth="4" />
      <circle className="spin-arc" cx="24" cy="24" r="19" fill="none" stroke={`url(#${grad})`} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
  if (!label && !block) return <span className={`spin ${className}`}>{icon}</span>;
  return (
    <span className={`spin ${block ? 'spin-block' : ''} ${className}`} role="status" aria-live="polite">
      {icon}
      {label && <span className="spin-label">{label}</span>}
    </span>
  );
}
