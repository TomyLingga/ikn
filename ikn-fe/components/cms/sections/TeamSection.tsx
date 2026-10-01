'use client';

import Image from 'next/image';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type TeamContent } from '../utils';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

// Profil pimpinan/tim: kartu foto potret, nama, jabatan, profil singkat. Tanpa foto tampil inisial di panel tema.
export default function TeamSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as TeamContent;
  const items = asList<TeamContent['items'][number]>(c.items).filter((item) => asText(item.name));
  if (items.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {lead && <p className="lead sec-lead">{lead}</p>}
        <div className="team-grid">
          {items.map((person, i) => {
            const name = asText(person.name);
            const position = tr(person.position, lang);
            const bio = tr(person.bio, lang);
            return (
              <Reveal as="article" key={i} className="team-card" delay={Math.min(i, 6) * 60}>
                <div className="team-photo">
                  {person.photo?.url ? (
                    <Image src={person.photo.url} alt={name} fill sizes="(max-width: 640px) 50vw, 280px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <span className="team-initials" aria-hidden="true">
                      {initials(name)}
                    </span>
                  )}
                </div>
                <h3 className="team-name">{name}</h3>
                {position && <span className="team-position">{position}</span>}
                {bio && <p className="team-bio">{bio}</p>}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
