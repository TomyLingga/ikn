'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import type { FormContent } from '../utils';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

const ui = {
  id: {
    subject: 'Perihal laporan',
    subjectPh: 'Ringkasan singkat',
    body: 'Uraian',
    bodyPh: 'Jelaskan dugaan pelanggaran (waktu, tempat, pihak terkait)',
    anonymous: 'Kirim secara anonim',
    name: 'Nama (opsional)',
    namePh: 'Nama pelapor',
    contact: 'Kontak (email / telepon)',
    contactPh: 'Agar tim dapat menghubungi Anda',
    attachment: 'Lampiran (opsional, PDF/JPG/PNG maks. 10 MB)',
    attachmentTooLarge: 'Ukuran lampiran melebihi 10 MB.',
    attachmentType: 'Lampiran harus berupa PDF, JPG, atau PNG.',
    send: 'Kirim laporan',
    sending: 'Mengirim…',
    successTitle: 'Laporan tercatat.',
    codeLabel: 'Kode laporan Anda:',
    successBody: 'Simpan kode ini untuk menanyakan tindak lanjut laporan.',
  },
  en: {
    subject: 'Report subject',
    subjectPh: 'Short summary',
    body: 'Description',
    bodyPh: 'Describe the suspected misconduct (time, place, parties involved)',
    anonymous: 'Submit anonymously',
    name: 'Name (optional)',
    namePh: 'Reporter name',
    contact: 'Contact (email / phone)',
    contactPh: 'So our team can reach you',
    attachment: 'Attachment (optional, PDF/JPG/PNG up to 10 MB)',
    attachmentTooLarge: 'The attachment exceeds 10 MB.',
    attachmentType: 'The attachment must be a PDF, JPG, or PNG file.',
    send: 'Submit report',
    sending: 'Sending…',
    successTitle: 'Report recorded.',
    codeLabel: 'Your report code:',
    successBody: 'Keep this code to follow up on your report.',
  },
};

// Whistle-blowing form (right column of the WBS page): POST /wbs, shows the returned code.
export default function WbsFormSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as FormContent;
  const s = ui[lang] || ui.id;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(s.attachmentTooLarge);
      e.target.value = '';
      setAttachment(null);
      return;
    }
    if (file.type && !ACCEPTED_MIMES.includes(file.type)) {
      setError(s.attachmentType);
      e.target.value = '';
      setAttachment(null);
      return;
    }
    setAttachment(file);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      let result: { code: string };
      if (attachment) {
        // Multipart when a file is attached; Laravel accepts '1'/'0' for the boolean rule.
        const formData = new FormData();
        formData.append('subject', subject);
        formData.append('body', body);
        formData.append('isAnonymous', anonymous ? '1' : '0');
        if (!anonymous) {
          if (reporterName) formData.append('reporterName', reporterName);
          formData.append('reporterContact', reporterContact);
        }
        formData.append('attachment', attachment);
        result = await api<{ code: string }>('/wbs', { method: 'POST', formData });
      } else {
        result = await api<{ code: string }>('/wbs', {
          method: 'POST',
          body: {
            subject,
            body,
            isAnonymous: anonymous,
            ...(anonymous ? {} : { reporterName: reporterName || undefined, reporterContact }),
          },
        });
      }
      setCode(result.code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <span className="label label-amber">{tr(c.label, lang)}</span>
      {code ? (
        <div className="form-success" style={{ marginTop: 24 }}>
          <div className="vm-icon">
            <Icon name="check" size={38} />
          </div>
          <h3 className="h3">{tr(c.success_title, lang) || s.successTitle}</h3>
          <p>
            {s.codeLabel} <strong>{code}</strong>
          </p>
          <p>{tr(c.success_body, lang) || s.successBody}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form" style={{ marginTop: 24 }}>
          <label>
            <span className="label">{s.subject}</span>
            <input
              type="text"
              required
              maxLength={200}
              placeholder={s.subjectPh}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            <span className="label">{s.body}</span>
            <textarea
              rows={5}
              required
              maxLength={5000}
              placeholder={s.bodyPh}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className="wbs-anon">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />{' '}
            <span>{s.anonymous}</span>
          </label>
          {!anonymous && (
            <>
              <label>
                <span className="label">{s.name}</span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder={s.namePh}
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                />
              </label>
              <label>
                <span className="label">{s.contact}</span>
                <input
                  type="text"
                  required
                  maxLength={160}
                  placeholder={s.contactPh}
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            <span className="label">{s.attachment}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={handleFile} />
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
