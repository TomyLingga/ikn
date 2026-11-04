'use client';

import type { CSSProperties } from 'react';
import Icon from '@/components/Icon';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { ANCHOR_BY_TYPE, asList, type ValuesContent } from '../utils';

// Tata nilai (AKHLAK), 2026-11-04: kartu dengan kepala (ikon, judul, pengantar), lalu wordmark dari huruf pertama
// tiap nilai (paruh pertama gelap, paruh kedua biru) di kiri dan daftar nilai dua kolom di kanan. Wordmark dibentuk
// dari judul bahasa Indonesia agar tetap "AKHLAK" di kedua bahasa.
export default function ValuesSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as ValuesContent;
  const items = asList<ValuesContent['items'][number]>(c.items);
  const words = items.map((v) => (v.title?.id || tr(v.title, lang)).split(/\s+/)[0] ?? '');
  const half = Math.ceil(words.length / 2);
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);

  return (
    <section className="section-tight vals" id={ANCHOR_BY_TYPE.values}>
      <div className="container">
        <Reveal className="vals-card">
          <header className="vals-head">
            <div className="vals-head-title">
              <span className="vals-icon" aria-hidden="true">
                <Icon name="shieldCheck" size={24} />
              </span>
              <div>
                {label && <span className="vals-label">{label}</span>}
                {heading && <h2 className="vals-title">{heading}</h2>}
              </div>
            </div>
            {lead && <p className="vals-lead">{lead}</p>}
          </header>
          <div className="vals-body">
            <div className="vals-mark" aria-hidden="true">
              <span className="vals-word">
                {words.map((w, i) => (
                  <span key={i} className={i < half ? 'is-a' : 'is-b'}>
                    {w.charAt(0).toUpperCase()}
                  </span>
                ))}
              </span>
              <span className="vals-sub">
                {words.map((w, i) => (
                  <span key={i}>
                    <b>{w.charAt(0).toUpperCase()}</b>
                    {w.slice(1).toUpperCase()}
                  </span>
                ))}
              </span>
            </div>
            <ul className="vals-list" style={{ '--rows': half } as CSSProperties}>
              {items.map((v, i) => (
                <li key={i} className={i < half ? 'is-a' : 'is-b'}>
                  <h3>{tr(v.title, lang)}</h3>
                  <p>{tr(v.body, lang)}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
