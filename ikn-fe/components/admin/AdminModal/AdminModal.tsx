'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Generic admin modal (backdrop + card). Rendered through a portal into <body>
// so nested modals (e.g. the media library inside a section form) are not
// trapped by the transform/overflow of the parent modal card.
interface AdminModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  small?: boolean;
  width?: number;
}

export default function AdminModal({ title, onClose, children, small = false, width }: AdminModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const style: CSSProperties | undefined = width ? { width: `min(100%, ${width}px)` } : undefined;

  return createPortal(
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div
        className={`admin-modal${small ? ' admin-modal-small' : ''}`}
        style={style}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="admin-modal-head">
          <h2>{title}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
