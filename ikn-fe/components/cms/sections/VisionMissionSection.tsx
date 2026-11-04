'use client';

import type { ReactNode } from 'react';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { ANCHOR_BY_TYPE, asList, pad2, type I18nItem, type VisionMissionContent } from '../utils';

/** Visi dengan frasa `highlight` (bila ada di dalam teks) dibungkus <em> bergaris lengkung. */
function highlighted(text: string, phrase: string): ReactNode {
  const at = phrase ? text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <em className="vmx-em">{text.slice(at, at + phrase.length)}</em>
      {text.slice(at + phrase.length)}
    </>
  );
}

// Visi & misi (2026-11-04, gaya referensi new.inl.co.id): visi sebagai kutipan besar di tengah, lalu kartu misi
// bernomor dengan angka besar samar. Label section = eyebrow misi; judul section dibaca pembaca layar saja.
export default function VisionMissionSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const { settings } = useSite();
  const c = section.content as VisionMissionContent;
  const missions = asList<I18nItem>(c.missions);
  const visionTag = tr(c.vision_tag, lang) || (lang === 'en' ? 'Vision' : 'Visi');
  const missionTag = tr(c.mission_tag, lang) || (lang === 'en' ? 'Mission' : 'Misi');
  const heading = tr(c.heading, lang);
  const missionLead = tr(c.mission_lead, lang);

  return (
    <section className="vmx" id={ANCHOR_BY_TYPE.vision_mission}>
      {heading && <h2 className="sr-only">{heading}</h2>}
      <div className="vmx-vision">
        <Reveal className="container vmx-vision-inner">
          <span className="vmx-tag">
            <span className="drop-bullet" aria-hidden="true" />
            {visionTag}
          </span>
          <span className="vmx-quote" aria-hidden="true">
            &ldquo;
          </span>
          <blockquote className="vmx-statement">{highlighted(tr(c.vision, lang), tr(c.vision_highlight, lang))}</blockquote>
          {settings.company.name && <p className="vmx-sign">{settings.company.name}</p>}
        </Reveal>
      </div>

      <div className="vmx-mission">
        <div className="container">
          <header className="vmx-mission-head">
            <div>
              {tr(c.label, lang) && (
                <span className="vmx-tag">
                  <span className="drop-bullet" aria-hidden="true" />
                  {tr(c.label, lang)}
                </span>
              )}
              <h3 className="vmx-mission-title">
                {missionTag}
                <sup>{pad2(missions.length)}</sup>
              </h3>
            </div>
            {missionLead && <p className="vmx-mission-lead">{missionLead}</p>}
          </header>
          <ol className="vmx-cards">
            {missions.map((m, i) => (
              <Reveal as="li" key={i} className="vmx-card" delay={Math.min(i, 5) * 80}>
                <span className="vmx-card-no">No. {pad2(i + 1)}</span>
                <span className="vmx-card-big" aria-hidden="true">
                  {i + 1}
                </span>
                <p>{tr(m.text, lang)}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
