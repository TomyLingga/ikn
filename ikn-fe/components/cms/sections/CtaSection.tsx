'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SmartLink from '../SmartLink';
import { asText, type CtaContent } from '../utils';

export default function CtaSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as CtaContent;
  const label = tr(c.label, lang);
  const button = tr(c.button_label, lang);

  return (
    <section className="cta">
      <div className="container cta-inner">
        {label && <span className="label label-amber">{label}</span>}
        <Reveal as="h2" className="h2 cta-title">
          {tr(c.title, lang)}
        </Reveal>
        {button && (
          <SmartLink href={asText(c.button_url) || '/kontak'} className="btn btn-amber cta-btn">
            {button} <Icon name="arrow" />
          </SmartLink>
        )}
      </div>
    </section>
  );
}
