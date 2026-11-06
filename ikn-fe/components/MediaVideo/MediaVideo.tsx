'use client';

import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties, type VideoHTMLAttributes } from 'react';
import type { MediaFrame } from '@/lib/cms';
import { frameStyle, mediaFrame } from '@/lib/media-frame';

// Video dari media library (ASUMSI A-92/A-93): berkas unggahan diputar <video>; media dari URL YouTube/Vimeo/Google
// Drive (field `embedUrl`) diputar lewat iframe pemutar penyedia. Mode `background` = autoplay, tanpa suara, berulang,
// tanpa kontrol, dan dipotong memenuhi kotak induk (seperti object-fit: cover; induk harus position relative/absolute).
// Bingkai (`frame`, dari source.frame atau prop) menggeser titik fokus/zoom dan membatasi pemutaran ke rentang
// start-end; video berkas mengulang di rentang itu, iframe dimuat ulang tiap rentang selesai.
// Video Google Drive tidak bisa autoplay (batasan Drive): di mode latar tampil sebagai pemutar diam; pakai YouTube.

export interface VideoSource {
  url: string;
  mime?: string | null;
  embedUrl?: string | null;
  provider?: string | null;
  thumbnailUrl?: string | null;
  frame?: MediaFrame | null;
}

export type MediaVideoProps = {
  source: VideoSource;
  background?: boolean;
  title?: string;
  className?: string;
  /** Bingkai pemakaian ini; bawaan = source.frame. */
  frame?: MediaFrame | null;
} & Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'className' | 'title'>;

/** Media ini diputar lewat iframe penyedia (bukan <video>)? */
export function isEmbedVideo(source: VideoSource | null | undefined): boolean {
  return Boolean(source?.embedUrl);
}

/** URL iframe dengan parameter sesuai mode (latar: autoplay, mute, loop, tanpa kontrol) dan rentang putar. */
export function embedSrc(source: VideoSource, background: boolean, frame?: MediaFrame | null): string {
  const base = source.embedUrl || '';
  const start = frame?.start ? Math.floor(frame.start) : 0;
  const end = frame?.end ? Math.ceil(frame.end) : 0;
  if (source.provider === 'youtube') {
    const id = base.split('/').pop() || '';
    const range = `${start ? `&start=${start}` : ''}${end ? `&end=${end}` : ''}`;
    // Dengan rentang, loop YouTube (playlist) akan kembali ke detik 0, jadi pengulangan diurus komponen (muat ulang).
    const loop = end ? '' : `&loop=1&playlist=${id}`;
    const params = background
      ? `autoplay=1&mute=1${loop}&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3${range}`
      : `rel=0&modestbranding=1&playsinline=1${range}`;
    return `${base}?${params}`;
  }
  if (source.provider === 'vimeo') {
    const params = background ? 'background=1&autoplay=1&loop=1&muted=1' : 'title=0&byline=0';
    return `${base}?${params}${start ? `#t=${start}s` : ''}`;
  }
  return base;
}

const MediaVideo = forwardRef<HTMLVideoElement, MediaVideoProps>(function MediaVideo(
  { source, background = false, title, className = '', frame: frameProp, style, onLoadedMetadata, onTimeUpdate, onEnded, loop, ...videoProps },
  ref,
) {
  const frame = frameProp !== undefined ? frameProp : mediaFrame(source);
  const start = frame?.start ?? 0;
  const end = frame?.end ?? null;
  const inner = useRef<HTMLVideoElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLVideoElement | null) => {
      inner.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  // Iframe dengan rentang: dimuat ulang tiap (end - start) detik agar mengulang dari `start` (mode latar).
  const embed = isEmbedVideo(source);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!embed || !background || end == null) return;
    const timer = window.setInterval(() => setCycle((c) => c + 1), Math.max(1, end - start) * 1000 + 800);
    return () => window.clearInterval(timer);
  }, [embed, background, start, end]);

  if (embed) {
    // Titik fokus untuk iframe berukuran cover: titik (x%, y%) iframe diletakkan di titik (x%, y%) kotak induk.
    const focus: CSSProperties | undefined = background && frame
      ? { left: `${frame.x}%`, top: `${frame.y}%`, transform: `translate(-${frame.x}%, -${frame.y}%)${frame.zoom > 1 ? ` scale(${frame.zoom})` : ''}`, transformOrigin: `${frame.x}% ${frame.y}%` }
      : undefined;
    return (
      <span className={`media-embed ${background ? 'is-bg' : 'is-inline'} ${className}`.trim()} aria-hidden={background || undefined} style={style}>
        <iframe
          key={cycle}
          src={embedSrc(source, background, frame)}
          title={title || 'Video'}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen={!background}
          loading="lazy"
          tabIndex={background ? -1 : undefined}
          referrerPolicy="strict-origin-when-cross-origin"
          style={focus}
        />
      </span>
    );
  }

  const ranged = start > 0 || end != null;
  return (
    <video
      ref={setRefs}
      src={source.url}
      className={className || undefined}
      title={title}
      style={{ ...frameStyle(frame), ...style }}
      // Rentang putar: loop bawaan kembali ke 0, jadi pengulangan di rentang diurus sendiri.
      loop={ranged ? false : loop}
      onLoadedMetadata={(e) => {
        if (start > 0) e.currentTarget.currentTime = start;
        onLoadedMetadata?.(e);
      }}
      onTimeUpdate={(e) => {
        const video = e.currentTarget;
        if (end != null && video.currentTime >= end) {
          if (loop) {
            video.currentTime = start;
            void video.play().catch(() => undefined);
          } else {
            video.pause();
            onEnded?.(e);
          }
        }
        onTimeUpdate?.(e);
      }}
      onEnded={(e) => {
        if (ranged && loop) {
          e.currentTarget.currentTime = start;
          void e.currentTarget.play().catch(() => undefined);
          return;
        }
        onEnded?.(e);
      }}
      {...videoProps}
    />
  );
});

export default MediaVideo;
