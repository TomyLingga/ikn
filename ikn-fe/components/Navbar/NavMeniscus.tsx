'use client';

import { useEffect, useRef, type RefObject } from 'react';
import styles from './Navbar.module.css';

// Pegas & bentuk lekukan (diadaptasi dari referensi new.inl.co.id, warna mengikuti tema biru IKN).
const SPRING = 0.14;
const DAMP = 0.74;
const HALF = 18; // setengah lebar lekukan (px)
const DEPTH = 3.5; // kedalaman lekukan saat diam (px)
const GLINT = 150; // lebar kilau gradien di sekitar tetesan (px)
const HAS_BEAD = styles.hasBead ?? 'hasBead';

/**
 * Garis tipis di bawah menu utama yang melengkung di bawah item yang di-hover/fokus (atau item aktif), dengan
 * tetesan lateks yang mengikuti lewat animasi pegas. Hanya layar lebar (>= 901px); ponsel memakai laci biasa.
 * `routeKey` = pathname, agar posisi diam pindah ke item aktif yang baru setelah navigasi.
 */
export default function NavMeniscus({ gridRef, routeKey }: { gridRef: RefObject<HTMLDivElement>; routeKey: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const beadRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    const grad = gradRef.current;
    const bead = beadRef.current;
    const wrap = grid?.parentElement;
    if (!grid || !svg || !path || !grad || !bead || !wrap) return;

    const wide = window.matchMedia('(min-width: 901px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = () => Array.from(grid.children) as HTMLElement[];
    const linkOf = (el: HTMLElement) => (el.matches('a') ? el : el.querySelector('a')) as HTMLElement | null;
    const activeItem = () => items().find((el) => linkOf(el)?.getAttribute('aria-current') === 'page') ?? null;

    let top = 0;
    let left = 0;
    let width = 0;
    let x: number | null = null;
    let v = 0;
    let target: number | null = null;
    let op = 0;
    let opTarget = 0;
    let raf = 0;
    let hovered: HTMLElement | null = null;

    const centerOf = (el: HTMLElement) => {
      const g = grid.getBoundingClientRect();
      const l = (linkOf(el) ?? el).getBoundingClientRect();
      return { x: l.left - g.left + l.width / 2, bottom: l.bottom - g.top };
    };
    const pick = () => {
      const el = hovered ?? activeItem();
      return el ? centerOf(el).x - left : x;
    };
    const draw = () => {
      if (x === null) return;
      const speed = Math.min(Math.abs(v), 24);
      const depth = (DEPTH + speed * 0.06) * op;
      const skew = Math.sign(v) * speed * 0.035;
      const l = HALF * (1 + Math.max(skew, -0.4));
      const r = HALF * (1 - Math.min(skew, 0.4));
      const y = (14 + depth).toFixed(2);
      path.setAttribute(
        'd',
        `M0 14 L${(x - l).toFixed(1)} 14 C${(x - l * 0.42).toFixed(1)} 14 ${(x - l * 0.34).toFixed(1)} ${y} ${x.toFixed(1)} ${y} ` +
          `C${(x + r * 0.34).toFixed(1)} ${y} ${(x + r * 0.42).toFixed(1)} 14 ${(x + r).toFixed(1)} 14 L${width} 14`,
      );
      grad.setAttribute('x1', String(x - GLINT));
      grad.setAttribute('x2', String(x + GLINT));
      svg.style.opacity = String(op);
      bead.style.opacity = String(op);
      bead.style.transform = `translate(${(left + x).toFixed(1)}px, ${(top + depth).toFixed(1)}px) translate(-50%, -50%)`;
    };
    const tick = () => {
      raf = 0;
      if (target === null) return;
      if (x === null || reduce) {
        x = target;
        v = 0;
      } else {
        v = (v + (target - x) * SPRING) * DAMP;
        x += v;
      }
      op += (opTarget - op) * (reduce ? 1 : 0.2);
      draw();
      if (Math.abs(target - x) > 0.05 || Math.abs(v) > 0.05 || Math.abs(opTarget - op) > 0.01) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const layout = () => {
      if (!wide.matches) return;
      const list = items();
      if (list.length === 0) return;
      const g = grid.getBoundingClientRect();
      const first = (linkOf(list[0]!) ?? list[0]!).getBoundingClientRect();
      const last = (linkOf(list[list.length - 1]!) ?? list[list.length - 1]!).getBoundingClientRect();
      top = Math.round(centerOf(list[0]!).bottom + 1);
      left = Math.round(first.left - g.left);
      width = Math.max(1, Math.round(last.right - first.left));
      svg.style.left = `${left}px`;
      svg.style.top = `${top - 14}px`;
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', '28');
      svg.setAttribute('viewBox', `0 0 ${width} 28`);
      target = pick();
      if (x === null && target !== null) x = target;
      draw();
    };
    const focusOn = (el: HTMLElement | null) => {
      hovered = el;
      const t = pick();
      if (t === null) return;
      target = t;
      opTarget = hovered || activeItem() ? 1 : 0;
      kick();
    };

    const cleanups: Array<() => void> = [];
    items().forEach((el) => {
      const enter = () => focusOn(el);
      el.addEventListener('mouseenter', enter);
      el.addEventListener('focusin', enter);
      cleanups.push(() => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('focusin', enter);
      });
    });
    const leave = () => focusOn(null);
    const focusOut = (e: FocusEvent) => {
      if (!grid.contains(e.relatedTarget as Node | null)) focusOn(null);
    };
    grid.addEventListener('mouseleave', leave);
    grid.addEventListener('focusout', focusOut);

    const init = () => {
      layout();
      if (activeItem()) {
        target = pick();
        x = target;
        op = 1;
        opTarget = 1;
        draw();
      }
      wrap.classList.add(HAS_BEAD);
    };
    const onMedia = () => (wide.matches ? init() : wrap.classList.remove(HAS_BEAD));
    const ro = new ResizeObserver(layout);
    ro.observe(grid);
    window.addEventListener('resize', layout, { passive: true });
    wide.addEventListener('change', onMedia);
    void document.fonts?.ready?.then(layout);
    if (wide.matches) init();

    return () => {
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      grid.removeEventListener('mouseleave', leave);
      grid.removeEventListener('focusout', focusOut);
      ro.disconnect();
      window.removeEventListener('resize', layout);
      wide.removeEventListener('change', onMedia);
      wrap.classList.remove(HAS_BEAD);
    };
  }, [gridRef, routeKey]);

  return (
    <>
      <svg ref={svgRef} className={styles.meniscus} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient ref={gradRef} id="nav-meniscus-glint" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset=".5" stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path ref={pathRef} stroke="url(#nav-meniscus-glint)" />
      </svg>
      <span ref={beadRef} className={styles.bead} aria-hidden="true" />
    </>
  );
}
