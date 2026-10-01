'use client';

import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { ANCHOR_BY_TYPE, asList, pad2, type I18nItem, type VisionMissionContent } from '../utils';

export default function VisionMissionSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as VisionMissionContent;
  const missions = asList<I18nItem>(c.missions);

  return (
    <section className="section" id={ANCHOR_BY_TYPE.vision_mission}>
      <div className="container">
        <SecHead label={tr(c.label, lang)} heading={tr(c.heading, lang)} reveal={false} />
        <div className="vm-grid">
          <Reveal className="vm-card vm-card-vision">
            <span className="vm-card-tag">{tr(c.vision_tag, lang) || (lang === 'en' ? 'Vision' : 'Visi')}</span>
            <p className="vm-vision">{tr(c.vision, lang)}</p>
          </Reveal>
          <Reveal className="vm-card" delay={100}>
            <span className="vm-card-tag">{tr(c.mission_tag, lang) || (lang === 'en' ? 'Mission' : 'Misi')}</span>
            <ol className="vm-list">
              {missions.map((m, i) => (
                <li key={i}>
                  <span className="vm-num">{pad2(i + 1)}</span>
                  <span>{tr(m.text, lang)}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
