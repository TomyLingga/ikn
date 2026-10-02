'use client';

import Icon from '@/components/Icon';
import SmartLink from '@/components/cms/SmartLink';
import { useSite } from '@/components/SiteProvider';
import { FileLink } from '@/components/FileViewer';

export interface HeroButton {
  label: string;
  url: string;
  style: 'solid' | 'outline' | string;
  profileDocument: boolean; // buka dokumen profil perusahaan (Pengaturan Situs) bila tersedia
  newTab: boolean;
}

interface HeroActionsProps {
  buttons: HeroButton[];
}

// Tombol hero (0..n) dari CMS. Gaya "solid" = tombol utama, "outline" = tombol garis.
// Tombol dengan profileDocument mengarah ke PDF profil perusahaan bila diunggah di Pengaturan Situs.
export default function HeroActions({ buttons }: HeroActionsProps) {
  const { settings } = useSite();
  const profileUrl = settings.company.profile_document?.url || '';
  const visible = buttons.filter((b) => b.label.trim() !== '');

  if (visible.length === 0) return null;

  return (
    <div className="hero-actions">
      {visible.map((b, i) => {
        const useProfile = b.profileDocument && !!profileUrl;
        const href = useProfile ? profileUrl : b.url;
        const outline = b.style === 'outline';
        if (useProfile) {
          const doc = settings.company.profile_document!;
          return (
            <FileLink key={i} file={{ url: doc.url, name: doc.originalName, mime: doc.mime }} className={outline ? 'btn btn-line' : 'btn btn-solid'}>
              {b.label} <Icon name="eye" size={16} />
            </FileLink>
          );
        }
        return (
          <SmartLink key={i} href={href} className={outline ? 'btn btn-line' : 'btn btn-solid'} newTab={useProfile || b.newTab}>
            {b.label}{' '}
            {outline ? <Icon name="arrow" size={15} style={{ transform: 'rotate(-45deg)' }} /> : <Icon name="arrow" />}
          </SmartLink>
        );
      })}
    </div>
  );
}
