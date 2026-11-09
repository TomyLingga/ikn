'use client';

// Banner status akun customer (pending / rejected / inactive). Akun `active` tidak menampilkan apa pun.
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';

export default function AccountStatusBanner({ context = 'dashboard' }: { context?: 'dashboard' | 'checkout' }) {
  const { customer } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  if (!customer || customer.status === 'active') return null;

  const isPending = customer.status === 'pending';
  const tone = isPending ? 'warn' : 'bad';
  const title = isPending
    ? t('Akun menunggu persetujuan', 'Account awaiting approval')
    : customer.status === 'rejected'
      ? t('Pendaftaran akun ditolak', 'Account registration rejected')
      : t('Akun nonaktif', 'Account inactive');
  const body = isPending
    ? context === 'checkout'
      ? t('Anda bisa checkout setelah akun disetujui. Sambil menunggu, Anda tetap bisa mengisi keranjang dan mengatur alamat.', 'You can check out once your account is approved. Meanwhile you can still fill your cart and manage addresses.')
      : t('Kami sedang memeriksa data perusahaan Anda. Kami kirim email begitu akun disetujui dan Anda bisa mulai memesan.', 'We are reviewing your company details. We will email you once your account is approved and you can start ordering.')
    : customer.status === 'rejected'
      ? customer.rejectionReason
        ? `${t('Alasan', 'Reason')}: ${customer.rejectionReason}`
        : t('Hubungi tim kami untuk informasi lebih lanjut.', 'Contact our team for more information.')
      : t('Hubungi tim kami untuk mengaktifkan kembali akun Anda.', 'Contact our team to reactivate your account.');

  return (
    <div className={`account-banner account-banner-${tone}`} role="status">
      <Icon name={isPending ? 'shieldCheck' : 'cancelCircle'} size={22} />
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {!isPending && (
        <Link href="/kontak" className="btn btn-line btn-sm">{t('Hubungi kami', 'Contact us')}</Link>
      )}
    </div>
  );
}
