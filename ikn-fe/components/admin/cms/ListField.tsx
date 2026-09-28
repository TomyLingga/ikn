'use client';

import type { ReactNode } from 'react';
import Icon from '@/components/Icon';

// Repeatable rows for `list` fields: add / remove / move up / move down.
interface ListFieldProps<T> {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, index: number, update: (next: T) => void) => ReactNode;
  maxItems?: number;
  error?: string;
  required?: boolean;
  itemHasError?: (index: number) => boolean;
  addLabel?: string;
}

export default function ListField<T>({
  label,
  items,
  onChange,
  createItem,
  renderItem,
  maxItems,
  error,
  required = false,
  itemHasError,
  addLabel = 'Tambah',
}: ListFieldProps<T>) {
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function update(index: number, value: T) {
    onChange(items.map((item, i) => (i === index ? value : item)));
  }

  const canAdd = maxItems === undefined || items.length < maxItems;

  return (
    <div className="cms-field cms-list">
      <div className="cms-list-head">
        <span className="field-label">
          {label}
          {required && <span className="cms-req">*</span>}
        </span>
        <span className="admin-field-hint">
          {items.length} item{maxItems ? ` / ${maxItems}` : ''}
        </span>
      </div>
      {error && <small className="cms-field-error">{error}</small>}
      {items.length === 0 && <p className="admin-field-hint">Belum ada item.</p>}
      {items.map((item, index) => (
        <div key={index} className={`cms-list-item${itemHasError?.(index) ? ' has-error' : ''}`}>
          <div className="cms-list-item-head">
            <span className="mono">#{index + 1}</span>
            <div className="cms-list-item-tools">
              <button
                type="button"
                className="row-act"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                title="Naik"
                aria-label="Naik"
              >
                <Icon name="arrowDown" size={13} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button
                type="button"
                className="row-act"
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
                title="Turun"
                aria-label="Turun"
              >
                <Icon name="arrowDown" size={13} />
              </button>
              <button
                type="button"
                className="row-act row-act-danger"
                onClick={() => remove(index)}
                title="Hapus"
                aria-label="Hapus"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="cms-list-item-body">{renderItem(item, index, (next) => update(index, next))}</div>
        </div>
      ))}
      {canAdd && (
        <div>
          <button type="button" className="btn btn-line btn-sm" onClick={() => onChange([...items, createItem()])}>
            <Icon name="plus" size={14} /> {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
