'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import type { FormContent } from '../utils';
import { emailError, isEmail } from '@/lib/validation';

const ui = {
  id: {
    name: 'Nama',
    namePh: 'Nama lengkap',
    email: 'Email',
    subject: 'Subjek',
    subjectPh: 'Perihal pesan',
    message: 'Pesan',
    messagePh: 'Tulis pesan Anda di sini',
    send: 'Kirim pesan',
    sending: 'Mengirim…',
    successTitle: 'Terima kasih.',
    successBody: 'Pesan Anda sudah tercatat. Tim kami akan menghubungi Anda secepatnya.',
  },
  en: {
    name: 'Name',
    namePh: 'Full name',
    email: 'Email',
    subject: 'Subject',
    subjectPh: 'What is this about?',
    message: 'Message',
    messagePh: 'Write your message here',
    send: 'Send message',
    sending: 'Sending…',
    successTitle: 'Thank you.',
    successBody: 'Your message has been recorded. Our team will get back to you shortly.',
  },
};

// Contact form (right column of /kontak): POST /contact. Rendered inside ContactGrid.
export default function ContactFormSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as FormContent;
  const s = ui[lang] || ui.id;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill dari katalog: /kontak?type=quote|stock&product=<slug> (tombol "Minta penawaran").
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const product = params.get('product');
    if (!type || !product) return;
    const isQuote = type === 'quote';
    setSubject((current) => current || (isQuote
      ? (lang === 'en' ? `Quotation request: ${product}` : `Permintaan penawaran: ${product}`)
      : (lang === 'en' ? `Availability inquiry: ${product}` : `Pertanyaan ketersediaan: ${product}`)));
    setMessage((current) => current || (isQuote
      ? (lang === 'en'
        ? `Hello, I would like to request a quotation for product "${product}". Quantity needed: ___. Please share pricing, lead time and delivery terms.`
        : `Halo, saya ingin meminta penawaran untuk produk "${product}". Jumlah kebutuhan: ___. Mohon informasi harga, waktu pengerjaan, dan syarat pengiriman.`)
      : (lang === 'en'
        ? `Hello, I would like to ask about the availability of product "${product}". Quantity needed: ___.`
        : `Halo, saya ingin menanyakan ketersediaan produk "${product}". Jumlah kebutuhan: ___.`)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError(emailError(email, lang === 'en' ? 'en' : 'id'));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api('/contact', {
        method: 'POST',
        body: { name, email, subject: subject || undefined, message },
      });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <span className="label label-amber">{tr(c.label, lang)}</span>
      {sent ? (
        <div className="form-success" style={{ marginTop: 24 }}>
          <div className="vm-icon">
            <Icon name="check" size={38} />
          </div>
          <h3 className="h3">{tr(c.success_title, lang) || s.successTitle}</h3>
          <p>{tr(c.success_body, lang) || s.successBody}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form" style={{ marginTop: 24 }}>
          <label>
            <span className="label">{s.name}</span>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              placeholder={s.namePh}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            <span className="label">{s.email}</span>
            <input
              type="email"
              name="email"
              required
              maxLength={190}
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError(email, lang === 'en' ? 'en' : 'id')}
            />
            {emailError(email, lang === 'en' ? 'en' : 'id') && <small className="form-error" role="alert">{emailError(email, lang === 'en' ? 'en' : 'id')}</small>}
          </label>
          <label>
            <span className="label">{s.subject}</span>
            <input
              type="text"
              name="subject"
              maxLength={200}
              placeholder={s.subjectPh}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            <span className="label">{s.message}</span>
            <textarea
              name="message"
              rows={4}
              required
              maxLength={5000}
              placeholder={s.messagePh}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-solid" disabled={sending}>
            {sending ? (
              s.sending
            ) : (
              <>
                {s.send} <Icon name="arrow" />
              </>
            )}
          </button>
        </form>
      )}
    </>
  );
}
