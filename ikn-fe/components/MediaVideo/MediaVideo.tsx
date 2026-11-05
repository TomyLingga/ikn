'use client';

import { forwardRef, type VideoHTMLAttributes } from 'react';

// Video dari media library (ASUMSI A-92): berkas unggahan diputar <video>; media dari URL YouTube/Vimeo/Google Drive
// (field `embedUrl`) diputar lewat iframe pemutar penyedia. Mode `background` = autoplay, tanpa suara, berulang, tanpa
// kontrol, dan dipotong memenuhi kotak induk (seperti object-fit: cover; induk harus position relative/absolute).
// Video Google Drive tidak bisa autoplay (batasan Drive): di mode latar tampil sebagai pemutar diam; pakai YouTube.

export interface VideoSource {
  url: string;
  mime?: string | null;
  embedUrl?: string | null;
  provider?: string | null;
  thumbnailUrl?: string | null;
}

export type MediaVideoProps = {
  source: VideoSource;
  background?: boolean;
  title?: string;
  className?: string;
} & Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'className' | 'title'>;

/** Media ini diputar lewat iframe penyedia (bukan <video>)? */
export function isEmbedVideo(source: VideoSource | null | undefined): boolean {
  return Boolean(source?.embedUrl);
}

/** URL iframe dengan parameter sesuai mode (latar: autoplay, mute, loop, tanpa kontrol). */
export function embedSrc(source: VideoSource, background: boolean): string {
  const base = source.embedUrl || '';
  if (source.provider === 'youtube') {
    const id = base.split('/').pop() || '';
    const params = background
      ? `autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3`
      : 'rel=0&modestbranding=1&playsinline=1';
    return `${base}?${params}`;
  }
  if (source.provider === 'vimeo') return `${base}?${background ? 'background=1&autoplay=1&loop=1&muted=1' : 'title=0&byline=0'}`;
  return base;
}

const MediaVideo = forwardRef<HTMLVideoElement, MediaVideoProps>(function MediaVideo({ source, background = false, title, className = '', ...videoProps }, ref) {
  if (isEmbedVideo(source)) {
    return (
      <span className={`media-embed ${background ? 'is-bg' : 'is-inline'} ${className}`.trim()} aria-hidden={background || undefined}>
        <iframe
          src={embedSrc(source, background)}
          title={title || 'Video'}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen={!background}
          loading="lazy"
          tabIndex={background ? -1 : undefined}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </span>
    );
  }
  return <video ref={ref} src={source.url} className={className || undefined} title={title} {...videoProps} />;
});

export default MediaVideo;
