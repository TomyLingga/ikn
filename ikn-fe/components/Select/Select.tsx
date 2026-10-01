'use client';

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/components/LanguageProvider';
import styles from './Select.module.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Placeholder kolom pencarian di panel pilihan. */
  searchPlaceholder?: string;
}

interface Item {
  value: string;
  label: string;
  disabled: boolean;
  group: string;
}

const PANEL_MIN_WIDTH = 240;
const PANEL_MAX_HEIGHT = 340;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function readItems(select: HTMLSelectElement): Item[] {
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.text.trim(),
    disabled: option.disabled,
    group: option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : '',
  }));
}

/** Set nilai <select> asli lalu kirim event "change" agar onChange React (dan form) berjalan seperti pilihan biasa. */
function commitValue(select: HTMLSelectElement, value: string) {
  if (select.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Dropdown yang bisa dicari. Pengganti langsung <select>: props, children <option>/<optgroup>, dan onChange(e) sama persis
 * (e.target tetap elemen <select> asli), jadi gaya CSS select yang sudah ada tetap berlaku. Klik/sentuh/keyboard pada select
 * membuka panel berkolom pencarian (portal ke body, posisi fixed, aman di dalam modal) alih-alih daftar bawaan peramban.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ searchPlaceholder, children, ...props }, forwardedRef) {
  const { lang } = useLang();
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});

  const setRefs = useCallback(
    (node: HTMLSelectElement | null) => {
      selectRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return items;
    return items.filter((item) => normalize(`${item.label} ${item.value} ${item.group}`).includes(q));
  }, [items, query]);

  const place = useCallback(() => {
    const select = selectRef.current;
    if (!select) return;
    const rect = select.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH), vw - 16);
    const left = Math.min(Math.max(8, rect.left), vw - width - 8);
    const below = vh - rect.bottom - 8;
    const above = rect.top - 8;
    const style: CSSProperties = { left, width };
    if (below < 220 && above > below) {
      style.bottom = vh - rect.top + 6;
      style.maxHeight = Math.min(PANEL_MAX_HEIGHT, above - 6);
    } else {
      style.top = rect.bottom + 6;
      style.maxHeight = Math.min(PANEL_MAX_HEIGHT, below - 6);
    }
    setPosition(style);
  }, []);

  const openPanel = useCallback(
    (initialQuery = '') => {
      const select = selectRef.current;
      if (!select || select.disabled) return;
      const next = readItems(select);
      setItems(next);
      setCurrent(select.value);
      setQuery(initialQuery);
      const selectedIndex = next.findIndex((item) => item.value === select.value);
      setActive(initialQuery ? 0 : Math.max(0, selectedIndex));
      place();
      setOpen(true);
    },
    [place],
  );

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) selectRef.current?.focus({ preventScroll: true });
  }, []);

  const pick = useCallback(
    (item: Item | undefined) => {
      if (!item || item.disabled) return;
      const select = selectRef.current;
      if (select) commitValue(select, item.value);
      close(true);
    },
    [close],
  );

  // Cegat pembuka daftar bawaan (mouse, sentuh, keyboard). Sentuhan: hanya tap (bukan geser) yang dicegat di touchend
  // (listener non-passive), jadi halaman tetap bisa digulir walau jari mulai di atas dropdown.
  useEffect(() => {
    const select = selectRef.current;
    if (!select) return;
    let touchStart: { x: number; y: number } | null = null;
    const toggle = () => {
      if (select.disabled) return;
      if (open) close(false);
      else {
        select.focus({ preventScroll: true });
        openPanel();
      }
    };
    const onMouse = (event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      toggle();
    };
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const start = touchStart;
      touchStart = null;
      if (!touch || !start || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return;
      event.preventDefault(); // membatalkan klik sintetis, jadi daftar bawaan ponsel tidak muncul
      toggle();
    };
    const onKey = (event: KeyboardEvent) => {
      if (open || event.ctrlKey || event.metaKey) return;
      const opens = ['ArrowDown', 'ArrowUp', 'Enter', ' ', 'F4'].includes(event.key);
      const typed = event.key.length === 1 && event.key !== ' ' && !event.altKey;
      if (!opens && !typed) return;
      event.preventDefault();
      openPanel(typed ? event.key : '');
    };
    select.addEventListener('mousedown', onMouse);
    select.addEventListener('touchstart', onTouchStart, { passive: true });
    select.addEventListener('touchend', onTouchEnd, { passive: false });
    select.addEventListener('keydown', onKey);
    return () => {
      select.removeEventListener('mousedown', onMouse);
      select.removeEventListener('touchstart', onTouchStart);
      select.removeEventListener('touchend', onTouchEnd);
      select.removeEventListener('keydown', onKey);
    };
  }, [open, openPanel, close]);

  // Opsi yang dimuat setelah panel terbuka (mis. daftar wilayah async) langsung ikut tampil.
  useEffect(() => {
    const select = selectRef.current;
    if (!open || !select) return;
    const observer = new MutationObserver(() => {
      setItems(readItems(select));
      setCurrent(select.value);
    });
    observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [open]);

  // Selama terbuka: klik di luar menutup, posisi mengikuti scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || selectRef.current?.contains(target)) return;
      close(false);
    };
    const onMove = (event: Event) => {
      if (event.type === 'scroll' && panelRef.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('touchstart', onDown, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('touchstart', onDown, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, close, place]);

  // Fokus ke kolom cari saat panel terbuka. Di layar sentuh, daftar pendek tidak langsung memunculkan keyboard.
  useLayoutEffect(() => {
    if (!open) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (!coarse || items.length > 8 || query) searchRef.current?.focus({ preventScroll: true });
    else panelRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Baris aktif selalu terlihat.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const move = (delta: number) => {
    if (filtered.length === 0) return;
    let next = active;
    for (let step = 0; step < filtered.length; step += 1) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next]?.disabled) break;
    }
    setActive(next);
  };

  const onPanelKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home' && event.target !== searchRef.current) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End' && event.target !== searchRef.current) {
      event.preventDefault();
      setActive(filtered.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(filtered[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    } else if (event.target !== searchRef.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      searchRef.current?.focus();
    }
  };

  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  let lastGroup = '';

  return (
    <>
      <select {...props} ref={setRefs} data-searchable="" aria-expanded={open} aria-controls={open ? listId : undefined}>
        {children}
      </select>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={styles.panel}
            style={position}
            tabIndex={-1}
            onKeyDown={onPanelKey}
            role="dialog"
            aria-label={props['aria-label'] ?? t('Pilih', 'Choose')}
          >
            <div className={styles.search}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                placeholder={searchPlaceholder ?? t('Cari…', 'Search…')}
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <ul ref={listRef} id={listId} role="listbox" className={styles.list}>
              {filtered.length === 0 && <li className={styles.empty}>{t('Tidak ada hasil', 'No results')}</li>}
              {filtered.map((item, index) => {
                const header = item.group && item.group !== lastGroup ? item.group : '';
                lastGroup = item.group;
                const selected = item.value === current;
                return (
                  <li key={`${item.group}|${item.value}|${index}`} role="presentation">
                    {header && <div className={styles.group}>{header}</div>}
                    <div
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={item.disabled || undefined}
                      className={`${styles.option} ${index === active ? styles.active : ''} ${selected ? styles.selected : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => !item.disabled && setActive(index)}
                      onClick={() => pick(item)}
                    >
                      <span>{item.label || ' '}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
});

export default Select;
