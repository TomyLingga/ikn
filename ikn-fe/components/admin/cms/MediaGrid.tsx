'use client';

import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import type { MediaSummary } from '@/lib/cms';

// Lencana media dari URL (A-92) di kisi media library.
const PROVIDER_LABEL: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', gdrive: 'Drive', url: 'URL' };

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(1))} ${units[index]}`;
}

export function isImageMedia(media: { mime: string }): boolean {
  return media.mime.startsWith('image/');
}

function extension(media: MediaSummary): string {
  const fromName = media.originalName.split('.').pop();
  if (fromName && fromName.length <= 5 && fromName !== media.originalName) return fromName;
  return media.mime.split('/').pop() || 'file';
}

// Thumbnail grid shared by the media library page and the picker modal.
interface MediaGridProps<T extends MediaSummary> {
  items: T[];
  selectedId?: number | null;
  onSelect?: (item: T) => void;
  actions?: (item: T) => ReactNode;
  empty?: ReactNode;
}

export default function MediaGrid<T extends MediaSummary>({
  items,
  selectedId,
  onSelect,
  actions,
  empty,
}: MediaGridProps<T>) {
  if (items.length === 0) return <div className="admin-empty">{empty ?? 'Belum ada media.'}</div>;

  return (
    <div className="media-grid">
      {items.map((item) => {
        const selected = selectedId != null && selectedId === item.id;
        const thumbUrl = isImageMedia(item) ? item.url : item.thumbnailUrl;
        const thumb = thumbUrl ? (
          <span className="media-thumb-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl} alt={item.originalName} loading="lazy" />
            {item.provider && <span className="media-thumb-badge">{PROVIDER_LABEL[item.provider] ?? 'URL'}</span>}
          </span>
        ) : item.provider ? (
          <div className="media-doc">
            <Icon name="video" size={22} />
            <span>{PROVIDER_LABEL[item.provider] ?? 'URL'}</span>
          </div>
        ) : (
          <div className="media-doc">
            <Icon name="quote" size={22} />
            <span>{extension(item)}</span>
          </div>
        );
        return (
          <div key={item.id} className={`media-card${selected ? ' is-selected' : ''}`}>
            {onSelect ? (
              <button type="button" className="media-thumb" onClick={() => onSelect(item)} aria-pressed={selected}>
                {thumb}
              </button>
            ) : (
              <div className="media-thumb">{thumb}</div>
            )}
            <div className="media-meta">
              <strong title={item.originalName}>{item.originalName}</strong>
              <small className="mono">
                {formatBytes(item.size)} · #{item.id}
              </small>
            </div>
            {actions && <div className="media-actions">{actions(item)}</div>}
          </div>
        );
      })}
    </div>
  );
}
