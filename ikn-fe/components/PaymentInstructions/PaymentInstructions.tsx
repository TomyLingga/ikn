'use client';

// Instruksi pembayaran untuk satu order: total (kode unik disorot), rekening tujuan / QRIS,
// teks instruksi metode, dan hitung mundur batas waktu. Dipakai halaman sukses checkout dan detail order.
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import { activePayment } from '@/lib/commerce';
import { formatDateTime, formatIDR } from '@/lib/format';
import type { BankAccountInfo, CommerceConfig, Order } from '@/lib/types';

function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return { expired: true, text: '00:00:00' };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { expired: false, text: `${pad(h)}:${pad(m)}:${pad(s)}` };
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      aria-label={label}
    >
      {copied ? <Icon name="check" size={14} /> : label}
    </button>
  );
}

export default function PaymentInstructions({ order, config }: { order: Order; config?: CommerceConfig | null }) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const countdown = useCountdown(order.status === 'pending_payment' ? order.paymentDueAt : null);

  const payment = activePayment(order);
  const methodCode = payment?.method || '';
  const methodInfo = config?.paymentMethods.find((m) => m.code === methodCode) || null;
  const isQris = methodInfo?.type === 'qris_static' || methodCode === 'qris_static' || !!payment?.qrisImageUrl;
  const qrisUrl = payment?.qrisImageUrl || methodInfo?.qrisImageUrl || null;
  const banks: BankAccountInfo[] = payment?.bankAccount ? [payment.bankAccount] : !isQris ? config?.bankAccounts || [] : [];
  const instructions = tr(payment?.instructions || methodInfo?.instructions, lang);
  const amount = payment?.amount ?? order.grandTotal;
  const uniqueCode = order.uniqueCode || 0;
  const amountText = String(amount);
  // formatIDR → "Rp 8.330.502": tiga digit terakhir = kode unik yang disorot.
  const formatted = formatIDR(amount);
  const highlightCode = uniqueCode > 0 && amount >= 1000;

  return (
    <div className="pay-box">
      <div className="pay-amount">
        <span className="label">{t('Total yang harus dibayar', 'Amount due')}</span>
        <strong>
          {highlightCode ? (
            <>
              {formatted.slice(0, -3)}
              <mark className="pay-unique">{formatted.slice(-3)}</mark>
            </>
          ) : (
            formatted
          )}
        </strong>
        <CopyButton value={amountText} label={t('Salin nominal', 'Copy amount')} />
      </div>
      {uniqueCode > 0 && (
        <p className="pay-note">
          {t('Transfer tepat sampai 3 digit terakhir (kode unik', 'Transfer the exact amount including the last 3 digits (unique code')} <strong>{String(uniqueCode).padStart(3, '0')}</strong>) {t('agar pembayaran cepat dicocokkan.', 'so the payment can be matched quickly.')}
        </p>
      )}

      {payment?.methodName || methodInfo?.name ? (
        <p className="pay-method">
          <Icon name="wallet" size={16} /> {tr(payment?.methodName || methodInfo?.name, lang)}
        </p>
      ) : null}

      {isQris && qrisUrl && (
        <div className="co-qris">
          <Image src={qrisUrl} alt="QRIS" width={220} height={220} unoptimized />
          <span className="qty-moq">{t('Pindai dengan aplikasi pembayaran Anda', 'Scan with your payment app')}</span>
        </div>
      )}

      {banks.length > 0 && (
        <div className="co-banks" style={{ margin: '16px 0' }}>
          {banks.map((bank) => (
            <div key={bank.id} className="co-bank bank-card">
              <div>
                <span className="co-bank-name">{bank.bankName}</span>
                <span className="co-bank-no">{bank.accountNumber}</span>
                <span className="co-bank-holder">a.n. {bank.accountHolder}</span>
              </div>
              <CopyButton value={bank.accountNumber} label={t('Salin', 'Copy')} />
            </div>
          ))}
        </div>
      )}

      {instructions && <p className="pd-quote-note">{instructions}</p>}

      {order.paymentDueAt && order.status === 'pending_payment' && (
        <div className={`pay-countdown ${countdown?.expired ? 'is-expired' : ''}`}>
          <Icon name="target" size={16} />
          <span>
            {t('Batas waktu', 'Deadline')}: <strong>{formatDateTime(order.paymentDueAt, lang)}</strong>
            {countdown && <> · <span className="pay-timer">{countdown.expired ? t('lewat', 'passed') : countdown.text}</span></>}
          </span>
        </div>
      )}
    </div>
  );
}
