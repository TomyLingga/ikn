'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnchorHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/Icon';
import styles from './FileViewer.module.css';

export interface ViewerFile {
  url: string;
  /** Nama yang ditampilkan dan dipakai saat mengunduh. */
  name?: string | null;
  mime?: string | null;
}

export type FileKind = 'pdf' | 'image' | 'video' | 'other';

export function fileKind(url: string, mime?: string | null): FileKind {
  const m = (mime || '').toLowerCase();
  const path = (url || '').split(/[?#]/)[0]!.toLowerCase();
  if (m === 'application/pdf' || path.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg|avif)$/.test(path)) return 'image';
  if (m.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(path)) return 'video';
  return 'other';
}

/** Bisa dipratinjau di dalam situs (PDF, gambar, video); tautan lain (halaman web) tetap dibuka biasa. */
export function isViewableFile(url: string | null | undefined, mime?: string | null): boolean {
  return !!url && fileKind(url, mime) !== 'other';
}

/** URL berkas media milik situs (disk public /storage/… atau privat /api/v1/files/…) yang bisa dipratinjau. */
export function isSiteFile(url: string | null | undefined, mime?: string | null): boolean {
  return isViewableFile(url, mime) && /\/storage\/|\/api\/v\d+\/files\//.test(url || '');
}

let listener: ((file: ViewerFile | null) => void) | null = null;

/** Buka berkas di penampil dalam situs. Tanpa host (mis. halaman cetak), jatuh ke tab baru. */
export function openFile(file: ViewerFile) {
  if (!file.url) return;
  if (!listener) {
    window.open(file.url, '_blank', 'noopener');
    return;
  }
  listener(file);
}

type FileLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  file: ViewerFile | null | undefined;
  children: ReactNode;
};

/**
 * Tautan berkas: klik biasa membuka penampil dalam situs; Ctrl/Cmd/klik tengah tetap memakai href (tab baru bila pengguna mau).
 * Pengganti <a href={file.url} target="_blank">.
 */
export function FileLink({ file, children, onClick, ...props }: FileLinkProps) {
  if (!file?.url) return <span className={props.className}>{children}</span>;
  return (
    <a
      {...props}
      href={file.url}
      onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openFile(file);
      }}
    >
      {children}
    </a>
  );
}

function fileName(file: ViewerFile): string {
  if (file.name) return file.name;
  try {
    return decodeURIComponent(new URL(file.url, window.location.href).pathname.split('/').pop() || 'berkas');
  } catch {
    return 'berkas';
  }
}

/** Berkas privat (/api/v1/files/...) butuh cookie sesi; berkas publik diambil tanpa kredensial. */
function needsCredentials(url: string) {
  return /\/api\/v\d+\/files\//.test(url);
}

async function downloadFile(file: ViewerFile) {
  const name = fileName(file);
  try {
    const response = await fetch(file.url, { credentials: needsCredentials(file.url) ? 'include' : 'omit' });
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(file.url, '_blank', 'noopener');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// PDF: dirender pdf.js ke canvas (sama di desktop dan ponsel; iframe tidak dipakai karena API produksi mengirim
// X-Frame-Options dan Chrome Android tidak menampilkan PDF di iframe). Halaman dirender saat mendekati layar.

type PdfDoc = import('pdfjs-dist').PDFDocumentProxy;
type PdfLib = typeof import('pdfjs-dist');

let pdfLib: Promise<PdfLib> | null = null;
function loadPdfLib(): Promise<PdfLib> {
  if (!pdfLib) {
    pdfLib = import('pdfjs-dist/legacy/build/pdf.mjs').then((lib) => {
      const mod = lib as unknown as PdfLib;
      if (!mod.GlobalWorkerOptions.workerPort) {
        mod.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
      }
      return mod;
    });
  }
  return pdfLib;
}

interface PdfViewProps {
  url: string;
  lang: 'id' | 'en';
  zoom: number;
  onPages: (count: number) => void;
  onPage: (page: number) => void;
}

function PdfPage({ doc, number, width, zoom }: { doc: PdfDoc; number: number; width: number; zoom: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [visible, setVisible] = useState(number <= 2);

  useEffect(() => {
    const el = holder.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !width) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void doc.getPage(number).then((page) => {
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const cssWidth = width * zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      c.style.width = `${cssWidth}px`;
      c.style.height = `${(cssWidth * base.height) / base.width}px`;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport });
      task.promise.catch(() => undefined);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, number, width, zoom, visible]);

  return (
    <div ref={holder} className={styles.pdfPage} data-page={number} style={{ width: width * zoom, minHeight: width * zoom * ratio }}>
      <canvas ref={canvas} aria-label={`Page ${number}`} />
    </div>
  );
}

function PdfView({ url, lang, zoom, onPages, onPage }: PdfViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    setDoc(null);
    setError('');
    loadPdfLib()
      .then((lib) => lib.getDocument({ url, withCredentials: needsCredentials(url), isEvalSupported: false }).promise)
      .then((pdf) => {
        loaded = pdf;
        if (cancelled) return void pdf.destroy();
        setDoc(pdf);
        onPages(pdf.numPages);
      })
      .catch(() => !cancelled && setError(lang === 'en' ? 'The PDF could not be displayed.' : 'PDF tidak dapat ditampilkan.'));
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setWidth(Math.min(el.clientWidth - 32, 980));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Nomor halaman yang sedang dibaca = halaman yang paling banyak terlihat.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !doc) return;
    const onScroll = () => {
      const mid = el.scrollTop + el.clientHeight / 3;
      let current = 1;
      el.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
        if (page.offsetTop <= mid) current = Number(page.dataset.page);
      });
      onPage(current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [doc, onPage]);

  return (
    <div ref={scroller} className={styles.pdfScroll}>
      {error && <p className={styles.message}>{error}</p>}
      {!doc && !error && <div className={styles.spinner} aria-label={lang === 'en' ? 'Loading' : 'Memuat'} />}
      {doc && width > 0 && Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} number={i + 1} width={width} zoom={zoom} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------

export default function FileViewerHost() {
  const [file, setFile] = useState<ViewerFile | null>(null);
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    listener = (next) => {
      opener.current = document.activeElement;
      setLang(document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'id');
      setZoom(1);
      setPages(0);
      setPage(1);
      setImageZoomed(false);
      setFile(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  const close = useCallback(() => {
    setFile(null);
    (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!file) return;
    closeBtn.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey, true);
    };
  }, [file, close]);

  if (!file) return null;
  const kind = fileKind(file.url, file.mime);
  const name = fileName(file);
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={name} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <header className={styles.bar}>
        <span className={styles.kind}>
          <Icon name={kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'package'} size={16} />
        </span>
        <strong className={styles.name} title={name}>
          {name}
        </strong>
        {kind === 'pdf' && pages > 0 && (
          <span className={styles.pages}>
            {page} / {pages}
          </span>
        )}
        <div className={styles.actions}>
          {kind === 'pdf' && (
            <div className={styles.zoom} role="group" aria-label="Zoom">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label={t('Perkecil', 'Zoom out')} disabled={zoom <= 0.5}>
                <Icon name="minus" size={16} />
              </button>
              <button type="button" className={styles.zoomValue} onClick={() => setZoom(1)} title={t('Pas lebar', 'Fit width')}>
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label={t('Perbesar', 'Zoom in')} disabled={zoom >= 3}>
                <Icon name="plus" size={16} />
              </button>
            </div>
          )}
          <button
            type="button"
            className={styles.action}
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              await downloadFile(file);
              setDownloading(false);
            }}
          >
            <Icon name="arrowDown" size={16} />
            <span>{downloading ? t('Mengunduh…', 'Downloading…') : t('Unduh', 'Download')}</span>
          </button>
          <button ref={closeBtn} type="button" className={styles.close} onClick={close} aria-label={t('Tutup', 'Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>

      <div className={styles.stage} onMouseDown={(e) => e.target === e.currentTarget && close()}>
        {kind === 'pdf' && <PdfView url={file.url} lang={lang} zoom={zoom} onPages={setPages} onPage={setPage} />}
        {kind === 'image' && (
          <div className={`${styles.imageWrap} ${imageZoomed ? styles.imageZoomed : ''}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.url} alt={name} onClick={() => setImageZoomed((z) => !z)} title={imageZoomed ? t('Klik untuk memperkecil', 'Click to fit') : t('Klik untuk ukuran asli', 'Click for full size')} />
          </div>
        )}
        {kind === 'video' && (
          <div className={styles.videoWrap}>
            <video src={file.url} controls autoPlay playsInline />
          </div>
        )}
        {kind === 'other' && (
          <div className={styles.other}>
            <Icon name="package" size={34} />
            <p>{t('Pratinjau tidak tersedia untuk jenis berkas ini.', 'No preview is available for this file type.')}</p>
            <button type="button" className="btn btn-solid btn-sm" onClick={() => void downloadFile(file)}>
              {t('Unduh berkas', 'Download file')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
