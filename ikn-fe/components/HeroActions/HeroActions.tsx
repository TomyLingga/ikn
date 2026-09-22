'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { t } from '@/lib/i18n';
import { api } from '@/lib/api';

export default function HeroActions() {
  const { lang } = useLang();
  const ui = t[lang] || t.id;

  const openCompanyProfile = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const data = await api<{
        type: 'url' | 'file';
        url: string;
        filePath: string;
      }>('/wbs/file');

      const target = data.type === 'url' && data.url ? data.url : data.filePath;

      if (target) {
        window.open(target, '_blank');
      } else {
        window.location.href = '/tentang';
      }
    } catch {
      window.location.href = '/tentang';
    }
  };

  return (
    <div className="hero-actions">
      <Link href="/produk" className="btn btn-solid">
        {ui.heroButtons.viewProducts} <Icon name="arrow" />
      </Link>
      <a
        href="/tentang"
        className="btn btn-line"
        onClick={(e) => void openCompanyProfile(e)}
      >
        {ui.heroButtons.companyProfile} <Icon name="arrow" size={15} style={{ transform: 'rotate(-45deg)' }} />
      </a>
    </div>
  );
}
