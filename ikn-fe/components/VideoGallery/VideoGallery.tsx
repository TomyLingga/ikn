'use client';

import { useEffect, useState } from 'react';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';

// Video YouTube: id dari URL youtu.be / youtube.com, judul & keterangan sudah dipilih bahasanya.
export interface Video {
  id: string;
  title: string;
  desc: string;
}

// Kartu pratinjau: thumbnail YouTube (maxres, fallback hq), tombol putar, judul & keterangan.
// Klik membuka pemutar layar penuh (iframe youtube-nocookie) — video tidak dimuat sebelum diklik.
function VideoCard({ video, delay, onOpen }: { video: Video; delay: number; onOpen: () => void }) {
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`);

  return (
    <Reveal delay={delay}>
      <button type="button" className="vg-card" onClick={onOpen} aria-label={`Putar: ${video.title}`}>
        <span className="vg-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            loading="lazy"
            onLoad={(e) => {
              // YouTube mengirim placeholder 120x90 bila maxres tidak ada.
              if (e.currentTarget.naturalWidth < 200 && !thumb.includes('hqdefault')) setThumb(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
            }}
            onError={() => setThumb(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`)}
          />
          <span className="vg-play" aria-hidden="true">
            <Icon name="play" size={26} strokeWidth={1.6} />
          </span>
          <span className="vg-badge" aria-hidden="true">
            YouTube
          </span>
        </span>
        <span className="vg-meta">
          <span className="vg-title">{video.title}</span>
          {video.desc && <span className="vg-desc">{video.desc}</span>}
        </span>
      </button>
    </Reveal>
  );
}

function VideoLightbox({ video, onClose }: { video: Video; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={video.title} onClick={onClose}>
      <button type="button" className="lightbox-btn lightbox-close" onClick={onClose} aria-label="Tutup">
        <Icon name="close" size={22} />
      </button>
      <figure className="video-lightbox" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <figcaption className="lightbox-cap">{video.title}</figcaption>
      </figure>
    </div>
  );
}

export default function VideoGallery({ videos }: { videos: Video[] }) {
  const [active, setActive] = useState<Video | null>(null);

  return (
    <>
      <div className="vg-grid">
        {videos.map((v, i) => (
          <VideoCard key={`${v.id}-${i}`} video={v} delay={Math.min(i, 6) * 90} onOpen={() => setActive(v)} />
        ))}
      </div>
      {active && <VideoLightbox video={active} onClose={() => setActive(null)} />}
    </>
  );
}
