'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import type { Lang } from '@/lib/types';
import SecHead from './SecHead';
import { ANCHOR_BY_TYPE, asList, asText, type OrgChartContent } from '../utils';

// Tingkat jabatan: kunci = SectionDefinitions::ORG_LEVELS (API); urutan = legenda; warna kartu/chip.
const LEVELS = [
  { key: 'rups', id: 'RUPS', en: 'Shareholders', color: '#64748b' },
  { key: 'komisaris', id: 'Dewan Komisaris', en: 'Commissioners', color: '#7c3aed' },
  { key: 'direksi', id: 'Direksi', en: 'Director', color: '#a855f7' },
  { key: 'sevp', id: 'SEVP', en: 'SEVP', color: '#0ea5e9' },
  { key: 'bagian', id: 'Bagian', en: 'Division', color: '#f59e0b' },
  { key: 'sub', id: 'Sub Bagian', en: 'Sub-division', color: '#3b82f6' },
  { key: 'asisten', id: 'Asisten', en: 'Assistant', color: '#10b981' },
  { key: 'mandor', id: 'Krani 1 / Mandor', en: 'Clerk 1 / Foreman', color: '#14b8a6' },
  { key: 'pelaksana', id: 'Pelaksana', en: 'Staff', color: '#ec4899' },
] as const;
type LevelKey = (typeof LEVELS)[number]['key'];
const LEVEL_KEYS = LEVELS.map((l) => l.key) as LevelKey[];
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

const levelOf = (raw: string, depth: number): LevelKey =>
  (LEVEL_KEYS as string[]).includes(raw) ? (raw as LevelKey) : LEVEL_KEYS[Math.min(depth, LEVEL_KEYS.length) - 1] ?? 'pelaksana';
type LevelMeta = (typeof LEVELS)[number];
const FALLBACK_LEVEL = LEVELS[LEVELS.length - 1] as LevelMeta;
const levelMeta = (key: LevelKey): LevelMeta => LEVELS.find((l) => l.key === key) ?? FALLBACK_LEVEL;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

interface TreeNode {
  key: string;
  title: string;
  holder: string;
  level: LevelKey;
  depth: number; // puncak = 1
  parent: string | null;
  children: TreeNode[];
}

// Rakit daftar datar (key, parent) menjadi pohon; simpul tanpa induk atau induk tak dikenal menjadi puncak.
function buildTree(nodes: OrgChartContent['nodes'], lang: Lang): { roots: TreeNode[]; byKey: Map<string, TreeNode> } {
  const byKey = new Map<string, TreeNode>();
  const order: { node: TreeNode; parent: string; rawLevel: string }[] = [];
  for (const raw of nodes) {
    const key = asText(raw.key).trim();
    if (!key || byKey.has(key)) continue;
    const node: TreeNode = { key, title: tr(raw.title, lang), holder: asText(raw.holder).trim(), level: 'pelaksana', depth: 1, parent: null, children: [] };
    byKey.set(key, node);
    order.push({ node, parent: asText(raw.parent).trim(), rawLevel: asText(raw.level) });
  }
  const roots: TreeNode[] = [];
  for (const { node, parent } of order) {
    const parentNode = parent ? byKey.get(parent) : undefined;
    if (parentNode && parentNode !== node) {
      parentNode.children.push(node);
      node.parent = parentNode.key;
    } else {
      roots.push(node);
    }
  }
  const walk = (node: TreeNode, depth: number, rawLevel: string) => {
    node.depth = depth;
    node.level = levelOf(rawLevel, depth);
    node.children.forEach((child) => walk(child, depth + 1, order.find((o) => o.node === child)?.rawLevel ?? ''));
  };
  roots.forEach((root) => walk(root, 1, order.find((o) => o.node === root)?.rawLevel ?? ''));
  return { roots, byKey };
}

function collectKeys(nodes: TreeNode[], predicate: (n: TreeNode) => boolean, out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0 && predicate(node)) out.push(node.key);
    collectKeys(node.children, predicate, out);
  }
  return out;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

// Struktur organisasi (section org_chart, anchor #struktur-organisasi): bagan pohon di viewport yang bisa digeser
// (seret), di-zoom (tombol, scroll, cubit dua jari), di-reset, dan dibuka layar penuh; kartu jabatan berlabel tingkat
// dan nama pejabat; pencarian menyorot jabatan/nama dan membuka jalurnya.
export default function OrgChartSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const en = lang === 'en';
  const c = section.content as OrgChartContent;
  const { roots, byKey } = useMemo(() => buildTree(asList<OrgChartContent['nodes'][number]>(c.nodes), lang), [c.nodes, lang]);
  const initialDepth = Number(c.expand_depth) > 0 ? Number(c.expand_depth) : 4;
  const [open, setOpen] = useState<Set<string>>(() => new Set(collectKeys(roots, (n) => n.depth < initialDepth)));
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ mode: 'pan' | 'pinch'; x: number; y: number; view: View; dist: number; cx: number; cy: number } | null>(null);

  const allNodes = useMemo(() => [...byKey.values()], [byKey]);
  const stats = useMemo(() => LEVELS.map((l) => ({ ...l, count: allNodes.filter((n) => n.level === l.key).length })).filter((l) => l.count > 0), [allNodes]);

  // Pencarian: sorot jabatan/nama yang cocok dan buka semua induknya.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(allNodes.filter((n) => n.title.toLowerCase().includes(q) || n.holder.toLowerCase().includes(q) || n.key.includes(q)).map((n) => n.key));
  }, [query, allNodes]);
  useEffect(() => {
    if (!matches || matches.size === 0) return;
    setOpen((current) => {
      const next = new Set(current);
      for (const key of matches) {
        let parent = byKey.get(key)?.parent ?? null;
        while (parent) {
          next.add(parent);
          parent = byKey.get(parent)?.parent ?? null;
        }
      }
      return next;
    });
  }, [matches, byKey]);

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Pas ke viewport: skala <= 1 agar seluruh bagan terlihat, dipusatkan horizontal.
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const canvas = canvasRef.current;
    if (!vp || !canvas) return;
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    if (!cw || !ch || !vw || !vh) return;
    const scale = clamp(Math.min(1, (vw - 32) / cw, (vh - 32) / ch), MIN_SCALE, MAX_SCALE);
    setView({ scale, x: (vw - cw * scale) / 2, y: 16 });
  }, []);
  useLayoutEffect(() => {
    fit();
  }, [fit]);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);
  const zoomCenter = (factor: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2);
  };

  // Scroll = zoom di posisi kursor (listener non-passive agar halaman tidak ikut bergulir).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = vp.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Seret satu jari/pointer = geser; dua jari = cubit untuk zoom.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const vp = viewportRef.current;
    if (!vp || (event.target as HTMLElement).closest('button')) return;
    vp.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const rect = vp.getBoundingClientRect();
      gesture.current = {
        mode: 'pinch',
        x: 0,
        y: 0,
        view,
        dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y),
        cx: (pts[0]!.x + pts[1]!.x) / 2 - rect.left,
        cy: (pts[0]!.y + pts[1]!.y) / 2 - rect.top,
      };
    } else {
      gesture.current = { mode: 'pan', x: event.clientX, y: event.clientY, view, dist: 0, cx: 0, cy: 0 };
      setDragging(true);
    }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (g.mode === 'pinch' && pts.length === 2) {
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const scale = clamp(g.view.scale * (dist / g.dist), MIN_SCALE, MAX_SCALE);
      const k = scale / g.view.scale;
      setView({ scale, x: g.cx - (g.cx - g.view.x) * k, y: g.cy - (g.cy - g.view.y) * k });
    } else if (g.mode === 'pan') {
      setView({ ...g.view, x: g.view.x + (event.clientX - g.x), y: g.view.y + (event.clientY - g.y) });
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    } else if (pointers.current.size === 1) {
      const [remaining] = [...pointers.current.values()];
      gesture.current = { mode: 'pan', x: remaining!.x, y: remaining!.y, view, dist: 0, cx: 0, cy: 0 };
    }
  };

  // Layar penuh: Fullscreen API bila ada, selain itu kelas CSS (mis. iOS Safari).
  useEffect(() => {
    const onChange = () => {
      setFullscreen(!!document.fullscreenElement);
      window.setTimeout(fit, 60);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [fit]);
  const toggleFullscreen = async () => {
    const el = sectionRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else {
        setFullscreen((f) => !f);
        window.setTimeout(fit, 60);
      }
    } catch {
      setFullscreen((f) => !f);
      window.setTimeout(fit, 60);
    }
  };

  if (roots.length === 0) return null;

  return (
    <section ref={sectionRef} className={`section-tight org-section${fullscreen ? ' is-fullscreen' : ''}`} id={ANCHOR_BY_TYPE.org_chart}>
      <div className="container">
        <SecHead label={tr(c.label, lang)} heading={tr(c.heading, lang)} />
        {tr(c.lead, lang) && <p className="lead org-lead">{tr(c.lead, lang)}</p>}

        <div className="org-stats" aria-label={en ? 'Summary' : 'Ringkasan'}>
          <span className="org-stat">
            <Icon name="users" size={16} /> <strong>{allNodes.length}</strong> {en ? 'positions' : 'jabatan'}
          </span>
          {stats.map((l) => (
            <span key={l.key} className="org-stat" style={{ '--org-c': l.color } as CSSProperties}>
              <span className="org-dot" /> <strong>{l.count}</strong> {en ? l.en : l.id}
            </span>
          ))}
        </div>

        <div className="org-toolbar">
          <label className="org-search">
            <Icon name="target" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={en ? 'Search position, key, or name…' : 'Cari jabatan, kunci, atau nama pejabat…'}
              aria-label={en ? 'Search the chart' : 'Cari di bagan'}
            />
            {matches && (
              <span className="org-search-count">
                {matches.size} {en ? 'found' : 'cocok'}
              </span>
            )}
          </label>
          <button type="button" className="btn btn-line btn-sm" onClick={() => setOpen(new Set(collectKeys(roots, () => true)))}>
            <Icon name="plus" size={14} /> {en ? 'Expand all' : 'Buka semua'}
          </button>
          <button type="button" className="btn btn-line btn-sm" onClick={() => setOpen(new Set(collectKeys(roots, (n) => n.depth < 2)))}>
            <Icon name="close" size={14} /> {en ? 'Collapse all' : 'Tutup semua'}
          </button>
        </div>

        <div
          ref={viewportRef}
          className={`org-viewport${dragging ? ' is-dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            const rect = viewportRef.current?.getBoundingClientRect();
            if (rect) zoomAt(1.4, e.clientX - rect.left, e.clientY - rect.top);
          }}
        >
          <div ref={canvasRef} className="org-canvas" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
            <div className="org-tree">
              <ul>
                {roots.map((node) => (
                  <OrgNode key={node.key} node={node} open={open} toggle={toggle} matches={matches} lang={lang} />
                ))}
              </ul>
            </div>
          </div>

          <div className="org-zoom" role="group" aria-label={en ? 'Zoom' : 'Perbesar'}>
            <button type="button" onClick={() => zoomCenter(1 / 1.25)} aria-label={en ? 'Zoom out' : 'Perkecil'} title={en ? 'Zoom out' : 'Perkecil'}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M8 11h6" />
              </svg>
            </button>
            <span className="org-zoom-pct">{Math.round(view.scale * 100)}%</span>
            <button type="button" onClick={() => zoomCenter(1.25)} aria-label={en ? 'Zoom in' : 'Perbesar'} title={en ? 'Zoom in' : 'Perbesar'}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M8 11h6M11 8v6" />
              </svg>
            </button>
            <button type="button" className="org-zoom-reset" onClick={fit}>
              Reset
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? (en ? 'Exit full screen' : 'Keluar layar penuh') : en ? 'Full screen' : 'Layar penuh'} title={fullscreen ? (en ? 'Exit full screen' : 'Keluar layar penuh') : en ? 'Full screen' : 'Layar penuh'}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {fullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
              </svg>
            </button>
          </div>
          <div className="org-hint" aria-hidden="true">
            {en ? 'Drag to move · scroll or pinch to zoom' : 'Seret untuk geser · scroll atau cubit untuk zoom'}
          </div>
        </div>

        <div className="org-legend" aria-label={en ? 'Legend' : 'Legenda'}>
          {stats.map((l) => (
            <span key={l.key} style={{ '--org-c': l.color } as CSSProperties}>
              <span className="org-dot" /> {en ? l.en : l.id}
            </span>
          ))}
          <span className="org-legend-note">{en ? 'Click a position to open the units below it.' : 'Klik jabatan untuk membuka bagian di bawahnya.'}</span>
        </div>
      </div>
    </section>
  );
}

interface OrgNodeProps {
  node: TreeNode;
  open: Set<string>;
  toggle: (key: string) => void;
  matches: Set<string> | null;
  lang: Lang;
}

function OrgNode({ node, open, toggle, matches, lang }: OrgNodeProps) {
  const en = lang === 'en';
  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && open.has(node.key);
  const meta = levelMeta(node.level);
  const isMatch = matches?.has(node.key) ?? false;
  const dim = !!matches && matches.size > 0 && !isMatch;

  return (
    <li>
      <div className={`org-card${isMatch ? ' is-match' : ''}${dim ? ' is-dim' : ''}`} style={{ '--org-c': meta.color } as CSSProperties}>
        <div className="org-card-head">
          <span className="org-chip">{en ? meta.en : meta.id}</span>
          <span className="org-code">{node.key}</span>
        </div>
        <h4 className="org-card-title">{node.title}</h4>
        <div className="org-card-person">
          {node.holder ? (
            <>
              <span className="org-avatar" aria-hidden="true">
                <Icon name="users" size={16} strokeWidth={1.6} />
              </span>
              <span className="org-person">
                <strong>{node.holder}</strong>
                <small>{en ? 'Holder' : 'Pejabat'}</small>
              </span>
            </>
          ) : (
            <span className="org-person org-person-empty">
              <em>{en ? 'Holder name not listed' : 'Nama pejabat belum diisi'}</em>
            </span>
          )}
        </div>
        {hasChildren && (
          <button type="button" className="org-toggle" onClick={() => toggle(node.key)} aria-expanded={isOpen}>
            {isOpen ? '−' : '+'} {node.children.length} {en ? (node.children.length === 1 ? 'unit' : 'units') : 'bagian'}
          </button>
        )}
      </div>
      {isOpen && (
        <ul>
          {node.children.map((child) => (
            <OrgNode key={child.key} node={child} open={open} toggle={toggle} matches={matches} lang={lang} />
          ))}
        </ul>
      )}
    </li>
  );
}
