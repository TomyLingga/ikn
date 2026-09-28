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
    ? t('Akun menunggu persetujuan admin', 'Account awaiting admin approval')
    : customer.status === 'rejected'
      ? t('Pendaftaran akun ditolak', 'Account registration rejected')
      : t('Akun nonaktif', 'Account inactive');
  const body = isPending
    ? context === 'checkout'
      ? t('Checkout baru bisa dilakukan setelah akun disetujui. Anda tetap bisa menyusun keranjang dan mengelola alamat.', 'Checkout becomes available once your account is approved. You can still build your cart and manage addresses.')
      : t('Kami sedang meninjau data perusahaan Anda. Anda akan menerima email begitu akun disetujui dan bisa mulai memesan.', 'We are reviewing your company details. You will get an email once your account is approved and you can start ordering.')
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
