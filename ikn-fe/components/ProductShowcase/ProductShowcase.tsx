'use client';

import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { Product } from '@/lib/types';

// Daftar produk di halaman /produk (company profile): nama, ringkasan, spesifikasi, tautan ke katalog.
export default function ProductShowcase({ products }: { products: Product[] }) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  return (
    <div className="prod-full">
      {products.map((p, i) => (
        <Reveal key={p.slug} id={p.slug} className="prod-item" delay={(i % 2) * 80}>
          <div className="prod-item-media">
            <span className="prod-code">{p.code}</span>
            {p.image ? (
              <Image src={p.image} alt={tr(p.name, lang)} fill sizes="(max-width:900px) 100vw, 480px" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="prod-item-drop">
                <Icon name="drop" size={72} strokeWidth={1} />
              </span>
            )}
          </div>
          <div>
            <span className="prod-item-kind">{p.kind || tr(p.category?.name, lang)}</span>
            <h2 className="prod-item-name">{tr(p.name, lang)}</h2>
            <p className="prod-item-sum">{tr(p.summary, lang)}</p>
            {p.specs && p.specs.length > 0 && (
              <div className="spec-table">
                {p.specs.map(([key, value], idx) => (
                  <div key={`${key}-${idx}`} className="spec-row">
                    <span className="spec-key">{key}</span>
                    <span className="spec-val">{value}</span>
                  </div>
                ))}
              </div>
            )}
            <Link href={`/catalog/${p.slug}`} className="link" style={{ marginTop: 18 }}>
              {t('Lihat di katalog', 'View in catalog')} <Icon name="arrow" />
            </Link>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
