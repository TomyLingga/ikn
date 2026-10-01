'use client';

import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { Product } from '@/lib/types';

// Pratinjau produk di halaman Bisnis (company profile): kartu ringkas berisi foto, jenis, nama, ringkasan,
// dua spesifikasi utama, dan tautan ke katalog. id = slug agar bisa dituju anchor (mis. /bisnis#resiprene-35).
export default function ProductShowcase({ products }: { products: Product[] }) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  return (
    <div className="biz-prod-grid">
      {products.map((p, i) => {
        const name = tr(p.name, lang);
        const href = `/catalog/${p.slug}`;
        const kind = p.kind || tr(p.category?.name, lang);
        const summary = tr(p.summary, lang);
        const specs = (p.specs || []).slice(0, 2);
        return (
          <Reveal as="article" key={p.slug} id={p.slug} className="biz-prod" delay={(i % 4) * 60}>
            <Link href={href} className="biz-prod-media" aria-label={name} tabIndex={-1}>
              {p.image ? (
                <Image src={p.image} alt={name} fill sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 300px" />
              ) : (
                <Icon name="drop" size={56} strokeWidth={1} />
              )}
            </Link>
            <div className="biz-prod-body">
              {kind && <span className="biz-prod-kind">{kind}</span>}
              <h3 className="biz-prod-name">
                <Link href={href}>{name}</Link>
              </h3>
              {summary && <p className="biz-prod-sum">{summary}</p>}
              {specs.length > 0 && (
                <dl className="biz-prod-specs">
                  {specs.map(([key, value], idx) => (
                    <div key={`${key}-${idx}`}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Link href={href} className="biz-prod-more">
                {t('Lihat di katalog', 'View in catalog')} <Icon name="arrow" size={14} />
              </Link>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
