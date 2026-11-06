'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import AdminModal from '@/components/admin/AdminModal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import type { MediaFrame, MediaSummary } from '@/lib/cms';
import { DEFAULT_FRAME, FRAME_ZOOM_MAX, formatSeconds, frameStyle, toFrame } from '@/lib/media-frame';

// Editor bingkai per pemakaian (ASUMSI A-93): klik/geser titik fokus di pratinjau besar, atur zoom, lihat hasilnya di
// tiga rasio frame (lebar, kotak, potret HP). Video: putar, lalu tetapkan detik mulai dan akhir yang dipakai.
// Berkas tidak diubah; hasilnya objek {x, y, zoom, start, end} (null = bawaan).

const PREVIEWS: { ratio: string; id: string; en: string }[] = [
  { ratio: '16 / 9', id: 'Lebar (16:9)', en: 'Wide (16:9)' },
  { ratio: '1 / 1', id: 'Kotak (1:1)', en: 'Square (1:1)' },
  { ratio: '3 / 4', id: 'Potret / HP (3:4)', en: 'Portrait / phone (3:4)' },
];

export default function FrameEditor({
  media,
  value,
  onSave,
  onClose,
}: {
  media: MediaSummary;
  value: MediaFrame | null | undefined;
  onSave: (frame: MediaFrame | null) => void;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [frame, setFrame] = useState<MediaFrame>({ ...DEFAULT_FRAME, ...(value ?? {}) });
  const isVideo = media.mime.startsWith('video/');
  const isEmbed = Boolean(media.embedUrl);
  // Gambar yang bisa dipakai untuk memilih titik fokus: gambar itu sendiri, atau thumbnail video dari URL.
  const still = !isVideo ? media.url : media.thumbnailUrl || null;
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rangePreview, setRangePreview] = useState(false);

  const patch = (next: Partial<MediaFrame>) => setFrame((f) => ({ ...f, ...next }));

  function pick(e: ReactPointerEvent<HTMLDivElement>) {
    const box = stage.current?.querySelector('img, video')?.getBoundingClientRect();
    if (!box) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100));
    patch({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }

  // Pratinjau rentang: ulang dari detik mulai saat mencapai detik akhir.
  useEffect(() => {
    const video = player.current;
    if (!video || !rangePreview) return;
    const onTime = () => {
      if (frame.end != null && video.currentTime >= frame.end) video.currentTime = frame.start ?? 0;
    };
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [rangePreview, frame.start, frame.end]);

  const save = () => onSave(toFrame(frame));
  const setStart = (v: number | null) => patch({ start: v != null && v > 0 ? Math.round(v * 10) / 10 : null });
  const setEnd = (v: number | null) => patch({ end: v != null && v > 0 ? Math.round(v * 10) / 10 : null });
  const rangeInvalid = frame.start != null && frame.end != null && frame.end <= frame.start;

  return (
    <AdminModal title={t('Atur bingkai', 'Adjust framing')} onClose={onClose} width={980}>
      <div className="admin-form frame-editor">
        <div className="frame-main">
          {still || (isVideo && !isEmbed) ? (
            <div
              ref={stage}
              className="frame-stage"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                pick(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) pick(e);
              }}
              role="presentation"
            >
              {isVideo && !isEmbed ? (
                <video
                  ref={player}
                  src={media.url}
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration || 0);
                    if (frame.start) e.currentTarget.currentTime = frame.start;
                  }}
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={still!} alt={media.originalName} draggable={false} />
              )}
              <span className="frame-dot" style={{ left: `${frame.x}%`, top: `${frame.y}%` }} aria-hidden="true" />
            </div>
          ) : (
            <div className="frame-stage frame-stage-empty">
              <Icon name="video" size={28} />
              <span>{t('Pratinjau titik fokus tidak tersedia untuk video ini; atur rentang di bawah.', 'No focus preview for this video; set the range below.')}</span>
            </div>
          )}
          <p className="admin-field-hint">
            {t('Klik atau geser di gambar untuk menentukan bagian yang harus selalu terlihat.', 'Click or drag on the image to set the part that must always stay visible.')}{' '}
            {t('Titik fokus', 'Focus point')}: {Math.round(frame.x)}% · {Math.round(frame.y)}%
          </p>

          <label className="frame-zoom">
            <span className="field-label">{t('Zoom', 'Zoom')}</span>
            <input type="range" min={1} max={FRAME_ZOOM_MAX} step={0.05} value={frame.zoom} onChange={(e) => patch({ zoom: Number(e.target.value) })} />
            <span className="mono">{frame.zoom.toFixed(2)}×</span>
          </label>

          {isVideo && (
            <div className="frame-video">
              <span className="field-label">{t('Bagian video yang diputar', 'Part of the video to play')}</span>
              {!isEmbed && (
                <div className="frame-player">
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    onClick={() => {
                      const v = player.current;
                      if (!v) return;
                      if (v.paused) void v.play();
                      else v.pause();
                    }}
                    aria-label={playing ? t('Jeda', 'Pause') : t('Putar', 'Play')}
                  >
                    <Icon name={playing ? 'pause' : 'play'} size={14} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={time}
                    onChange={(e) => {
                      if (player.current) player.current.currentTime = Number(e.target.value);
                    }}
                    aria-label={t('Posisi video', 'Video position')}
                  />
                  <span className="mono">
                    {formatSeconds(time)} / {formatSeconds(duration)}
                  </span>
                </div>
              )}
              <div className="frame-range">
                <label>
                  <span className="field-label">{t('Mulai (detik)', 'Start (seconds)')}</span>
                  <input type="number" min={0} step={0.1} value={frame.start ?? ''} onChange={(e) => setStart(e.target.value === '' ? null : Number(e.target.value))} placeholder="0" />
                  {!isEmbed && (
                    <button type="button" className="row-act" onClick={() => setStart(time)}>
                      {t('Pakai posisi sekarang', 'Use current position')}
                    </button>
                  )}
                </label>
                <label>
                  <span className="field-label">{t('Akhir (detik)', 'End (seconds)')}</span>
                  <input type="number" min={0} step={0.1} value={frame.end ?? ''} onChange={(e) => setEnd(e.target.value === '' ? null : Number(e.target.value))} placeholder={t('sampai habis', 'to the end')} />
                  {!isEmbed && (
                    <button type="button" className="row-act" onClick={() => setEnd(time)}>
                      {t('Pakai posisi sekarang', 'Use current position')}
                    </button>
                  )}
                </label>
              </div>
              {!isEmbed && (
                <label className="frame-check">
                  <input
                    type="checkbox"
                    checked={rangePreview}
                    onChange={(e) => {
                      setRangePreview(e.target.checked);
                      if (e.target.checked && player.current) {
                        player.current.currentTime = frame.start ?? 0;
                        void player.current.play();
                      }
                    }}
                  />
                  {t('Putar ulang hanya bagian ini', 'Loop only this part')}
                </label>
              )}
              {rangeInvalid && <small className="cms-field-error">{t('Detik akhir harus lebih besar dari detik mulai.', 'End must be after start.')}</small>}
              {media.provider === 'gdrive' && (
                <small className="admin-field-hint">{t('Video Google Drive tidak mendukung rentang putar.', 'Google Drive videos do not support a play range.')}</small>
              )}
            </div>
          )}
        </div>

        <aside className="frame-previews" aria-label={t('Pratinjau frame', 'Frame previews')}>
          <span className="field-label">{t('Hasil di frame', 'Result in frames')}</span>
          {PREVIEWS.map((p) => (
            <figure key={p.ratio}>
              <div className="frame-preview" style={{ aspectRatio: p.ratio }}>
                {isVideo && !isEmbed ? (
                  <video src={media.url} muted playsInline preload="metadata" style={frameStyle(frame)} onLoadedMetadata={(e) => (e.currentTarget.currentTime = frame.start ?? 0.1)} />
                ) : still ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={still} alt="" style={frameStyle(frame)} />
                ) : (
                  <Icon name="video" size={22} />
                )}
              </div>
              <figcaption>{lang === 'en' ? p.en : p.id}</figcaption>
            </figure>
          ))}
        </aside>
      </div>

      <div className="admin-modal-actions">
        <button type="button" className="btn btn-line btn-sm" onClick={() => setFrame({ ...DEFAULT_FRAME })}>
          {t('Kembalikan ke tengah', 'Reset to centre')}
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-line btn-sm" onClick={onClose}>
          {t('Batal', 'Cancel')}
        </button>
        <button type="button" className="btn btn-solid btn-sm" onClick={save} disabled={rangeInvalid}>
          {t('Simpan bingkai', 'Save framing')}
        </button>
      </div>
    </AdminModal>
  );
}
