'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type I18nItem, type TeamContent, type TeamMember } from '../utils';

function initials(name: string): string {
  return name
    .replace(/^(drs?|ir|dr|h|hj)\.\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function Portrait({ person, sizes }: { person: TeamMember; sizes: string }) {
  const name = asText(person.name);
  return person.photo?.url ? (
    <Image src={person.photo.url} alt={name} fill sizes={sizes} style={{ objectFit: 'cover', objectPosition: 'top center' }} />
  ) : (
    <span className="team-initials" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// Profil pimpinan (2026-11-04, gaya ptpn4.co.id): kartu potret tinggi dalam karusel geser (panah + titik), nama dan
// jabatan di atas gradasi bawah foto. Klik kartu membuka detail perorangan: pendidikan, perjalanan karir, jabatan &
// dasar pengangkatan, dan kutipan. Bagian detail yang kosong tidak ditampilkan.
export default function TeamSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as TeamContent;
  const items = asList<TeamMember>(c.items).filter((item) => asText(item.name));
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState({ index: 0, count: 1, start: true, end: true });
  const [open, setOpen] = useState<TeamMember | null>(null);
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const card = el.querySelector<HTMLElement>('.team-card');
      const step = card ? card.offsetWidth + 24 : el.clientWidth;
      const count = Math.max(1, Math.round((el.scrollWidth - el.clientWidth) / step) + 1);
      setPage({
        index: Math.min(count - 1, Math.round(el.scrollLeft / step)),
        count,
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (items.length === 0) return null;

  function go(index: number) {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>('.team-card');
    if (!el || !card) return;
    el.scrollTo({ left: index * (card.offsetWidth + 24), behavior: 'smooth' });
  }

  return (
    <section className="section-tight team" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {lead && <p className="lead sec-lead">{lead}</p>}
        <div className="team-carousel">
          {!page.start && (
            <button type="button" className="team-arrow is-prev" onClick={() => go(page.index - 1)} aria-label={lang === 'en' ? 'Previous' : 'Sebelumnya'}>
              <Icon name="chevronLeft" size={22} />
            </button>
          )}
          <div className="team-track" ref={track}>
            {items.map((person, i) => {
              const name = asText(person.name);
              const position = tr(person.position, lang);
              return (
                <button type="button" key={i} className="team-card" onClick={() => setOpen(person)} aria-label={`${name}${position ? `, ${position}` : ''}`}>
                  <span className="team-photo">
                    <Portrait person={person} sizes="(max-width: 640px) 80vw, 360px" />
                  </span>
                  <span className="team-overlay">
                    <span className="team-name">{name}</span>
                    {position && <span className="team-position">{position}</span>}
                  </span>
                  <span className="team-plus" aria-hidden="true">
                    <Icon name="plus" size={14} />
                  </span>
                </button>
              );
            })}
          </div>
          {!page.end && (
            <button type="button" className="team-arrow is-next" onClick={() => go(page.index + 1)} aria-label={lang === 'en' ? 'Next' : 'Berikutnya'}>
              <Icon name="chevronRight" size={22} />
            </button>
          )}
        </div>
        {page.count > 1 && (
          <div className="team-dots" role="tablist">
            {Array.from({ length: page.count }, (_, i) => (
              <button key={i} type="button" className={i === page.index ? 'is-active' : ''} onClick={() => go(i)} aria-label={`${i + 1}`} />
            ))}
          </div>
        )}
      </div>

      {open &&
        createPortal(
          <TeamDetail person={open} group={heading || label} lang={lang} onClose={() => setOpen(null)} />,
          document.body,
        )}
    </section>
  );
}

function TeamDetail({ person, group, lang, onClose }: { person: TeamMember; group: string; lang: 'id' | 'en'; onClose: () => void }) {
  const name = asText(person.name);
  const position = tr(person.position, lang);
  const education = tr(person.education, lang);
  const career = asList<I18nItem>(person.career).map((c) => tr(c.text, lang)).filter(Boolean);
  const appointment = tr(person.appointment, lang);
  const quoteTitle = tr(person.quote_title, lang);
  const quoteBody = tr(person.quote_body, lang);
  const bio = tr(person.bio, lang);
  const en = lang === 'en';
  const empty = en ? 'Information not yet available.' : 'Informasi belum tersedia.';

  return (
    <div className="team-modal site-v2" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <div className="team-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="team-modal-top">
          <span className="team-modal-group">{group}</span>
          <button type="button" className="team-modal-close" onClick={onClose} aria-label={en ? 'Close' : 'Tutup'} autoFocus>
            <Icon name="close" size={22} />
          </button>
        </div>
        <h2 className="team-modal-name">{name}</h2>
        {position && <p className="team-modal-position">{position}</p>}
        <div className="team-modal-body">
          <div className="team-modal-info">
            {bio && <p className="team-modal-bio">{bio}</p>}
            {/* Tiga bagian baku selalu tampil; yang belum diisi admin diberi keterangan, bukan teks karangan. */}
            <section>
              <h3>{en ? 'Education' : 'Pendidikan'}</h3>
              {education ? <p>{education}</p> : <p className="team-modal-empty">{empty}</p>}
            </section>
            <section>
              <h3>{en ? 'Career' : 'Perjalanan Karir'}</h3>
              {career.length > 0 ? (
                <ul>
                  {career.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="team-modal-empty">{empty}</p>
              )}
            </section>
            <section>
              <h3>{en ? 'Position & Legal Basis of Appointment' : 'Jabatan dan Dasar Pengangkatan'}</h3>
              {appointment ? <p>{appointment}</p> : <p className="team-modal-empty">{empty}</p>}
            </section>
          </div>
          <div className="team-modal-figure">
            <span className="team-modal-photo">
              <Portrait person={person} sizes="(max-width: 900px) 80vw, 420px" />
            </span>
            {(quoteTitle || quoteBody) && (
              <blockquote className="team-modal-quote">
                {quoteTitle && <strong>{quoteTitle}</strong>}
                {quoteBody && <p>{quoteBody}</p>}
              </blockquote>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
