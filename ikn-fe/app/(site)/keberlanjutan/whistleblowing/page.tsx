'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import { api, errorMessage } from '@/lib/api';

export default function Whistleblowing() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const result = await api<{ code: string }>('/wbs', {
        method: 'POST',
        body: {
          subject,
          body,
          anonymous,
          ...(anonymous ? {} : { contact }),
        },
      });
      setCode(result.code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="section-tight">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-left">
              <div className="contact-block">
                <span className="label label-green">/ Tentang WBS</span>
                <p style={{ marginTop: 12, maxWidth: '46ch' }}>
                  Whistle Blowing System (WBS) adalah kanal pelaporan dugaan
                  pelanggaran di lingkungan PT Industri Karet Nusantara. Identitas
                  pelapor dijaga kerahasiaannya sesuai kebijakan perusahaan.
                </p>
              </div>
              <div className="contact-block">
                <span className="label label-green">/ Yang dapat dilaporkan</span>
                <ul className="vm-list" style={{ marginTop: 12 }}>
                  {['Korupsi, suap, atau gratifikasi', 'Benturan kepentingan', 'Pelanggaran prosedur & keselamatan', 'Penyalahgunaan wewenang'].map((p, i) => (
                    <li key={p}><span className="index">0{i + 1}</span><span>{p}</span></li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="contact-right">
              <span className="label label-amber">/ Kirim laporan</span>
              {code ? (
                <div className="form-success" style={{ marginTop: 24 }}>
                  <div className="vm-icon"><Icon name="check" size={38} /></div>
                  <h3 className="h3">Laporan tercatat.</h3>
                  <p>
                    Kode laporan Anda: <strong>{code}</strong>
                  </p>
                  <p>
                    Simpan kode ini untuk menanyakan tindak lanjut laporan.
                    Laporan Anda akan ditinjau tim terkait secara rahasia.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="form" style={{ marginTop: 24 }}>
                  <label>
                    <span className="label">Perihal laporan</span>
                    <input
                      type="text"
                      required
                      placeholder="Ringkasan singkat"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="label">Uraian</span>
                    <textarea
                      rows={5}
                      required
                      placeholder="Jelaskan dugaan pelanggaran (waktu, tempat, pihak terkait)"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </label>
                  <label className="wbs-anon">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                    />{' '}
                    <span>Kirim secara anonim</span>
                  </label>
                  {!anonymous && (
                    <label>
                      <span className="label">Kontak (email / telepon)</span>
                      <input
                        type="text"
                        required
                        placeholder="Agar tim dapat menghubungi Anda"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                      />
                    </label>
                  )}
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <button type="submit" className="btn btn-solid" disabled={sending}>
                    {sending ? 'Mengirim…' : <>Kirim laporan <Icon name="arrow" /></>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
