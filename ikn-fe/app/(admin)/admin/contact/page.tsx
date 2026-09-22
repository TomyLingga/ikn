'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { AdminPageHead, AdminCard } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface ContactLocation {
  name: string;
  address: string;
  phone: string[];
}

interface ContactSocial {
  label: string;
  handle: string;
  href: string;
}

interface ContactData {
  locations?: unknown;
  emails?: unknown;
  social?: unknown;
}

interface BlockResponse {
  key: string;
  data: ContactData | null;
  updatedAt: string | null;
}

function parseData(data: ContactData | null): {
  locations: ContactLocation[];
  emails: string[];
  social: ContactSocial[];
} {
  const locations = Array.isArray(data?.locations)
    ? (data!.locations as unknown[]).map((entry) => {
        const location = (entry ?? {}) as Record<string, unknown>;
        return {
          name: String(location.name ?? ''),
          address: String(location.address ?? ''),
          phone: Array.isArray(location.phone) ? (location.phone as unknown[]).map((p) => String(p ?? '')) : [],
        };
      })
    : [];
  const emails = Array.isArray(data?.emails) ? (data!.emails as unknown[]).map((item) => String(item ?? '')) : [];
  const social = Array.isArray(data?.social)
    ? (data!.social as unknown[]).map((entry) => {
        const item = (entry ?? {}) as Record<string, unknown>;
        return {
          label: String(item.label ?? ''),
          handle: String(item.handle ?? ''),
          href: String(item.href ?? ''),
        };
      })
    : [];
  return { locations, emails, social };
}

export default function AdminContact() {
  const [locations, setLocations] = useState<ContactLocation[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [social, setSocial] = useState<ContactSocial[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const block = await api<BlockResponse>('/admin/blocks/contact');
      const parsed = parseData(block.data);
      setLocations(parsed.locations);
      setEmails(parsed.emails);
      setSocial(parsed.social);
      setUpdatedAt(block.updatedAt);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function updateLocation(index: number, patch: Partial<ContactLocation>) {
    setLocations((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = {
        locations: locations
          .map((location) => ({
            name: location.name.trim(),
            address: location.address.trim(),
            phone: location.phone.map((p) => p.trim()).filter(Boolean),
          }))
          .filter((location) => location.name || location.address),
        emails: emails.map((email) => email.trim()).filter(Boolean),
        social: social
          .map((item) => ({ label: item.label.trim(), handle: item.handle.trim(), href: item.href.trim() }))
          .filter((item) => item.label || item.handle || item.href),
      };
      await api('/admin/blocks/contact', { method: 'PUT', body: { data } });
      setLocations(data.locations);
      setEmails(data.emails);
      setSocial(data.social);
      setNotice('Informasi kontak tersimpan.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <AdminPageHead title="Contact Us" desc="Kelola informasi kontak dan lokasi perusahaan." />
        <p className="admin-note">Memuat data...</p>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHead title="Contact Us" desc="Kelola informasi kontak dan lokasi perusahaan." />

      {notice && <div className="admin-toast" role="status">{notice}</div>}
      {error && <p className="form-error">{error}</p>}

      <AdminCard title="Lokasi">
        <div className="admin-form">
          {locations.length === 0 && <p className="admin-note">Belum ada lokasi.</p>}
          {locations.map((location, index) => (
            <div key={index} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">Nama lokasi</span>
                  <input
                    value={location.name}
                    onChange={(event) => updateLocation(index, { name: event.target.value })}
                    placeholder="Contoh: Kantor Pusat"
                  />
                </label>
                <label>
                  <span className="field-label">Telepon (pisahkan dengan koma)</span>
                  <input
                    value={location.phone.join(', ')}
                    onChange={(event) =>
                      updateLocation(index, { phone: event.target.value.split(',').map((p) => p.trimStart()) })
                    }
                    placeholder="+62 61 786 7356, +62 811 648 0083"
                  />
                </label>
              </div>
              <label>
                <span className="field-label">Alamat</span>
                <textarea
                  rows={2}
                  value={location.address}
                  onChange={(event) => updateLocation(index, { address: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="row-act row-act-danger"
                onClick={() => setLocations((current) => current.filter((_, i) => i !== index))}
              >
                Hapus lokasi
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-line btn-sm"
            onClick={() => setLocations((current) => [...current, { name: '', address: '', phone: [] }])}
          >
            <Icon name="plus" size={16} /> Tambah lokasi
          </button>
        </div>
      </AdminCard>

      <div style={{ height: 18 }} />

      <AdminCard title="Email">
        <div className="admin-form">
          {emails.length === 0 && <p className="admin-note">Belum ada email.</p>}
          {emails.map((email, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmails((current) => current.map((v, i) => (i === index ? event.target.value : v)))
                }
                placeholder="nama@ptikn.com"
                aria-label={`Email ${index + 1}`}
              />
              <button
                type="button"
                className="row-act row-act-danger"
                onClick={() => setEmails((current) => current.filter((_, i) => i !== index))}
              >
                Hapus
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-line btn-sm" onClick={() => setEmails((current) => [...current, ''])}>
            <Icon name="plus" size={16} /> Tambah email
          </button>
        </div>
      </AdminCard>

      <div style={{ height: 18 }} />

      <AdminCard title="Media sosial">
        <div className="admin-form">
          {social.length === 0 && <p className="admin-note">Belum ada media sosial.</p>}
          {social.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '150px 180px 1fr auto', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <input
                value={item.label}
                onChange={(event) =>
                  setSocial((current) => current.map((v, i) => (i === index ? { ...v, label: event.target.value } : v)))
                }
                placeholder="Instagram"
                aria-label={`Platform ${index + 1}`}
              />
              <input
                value={item.handle}
                onChange={(event) =>
                  setSocial((current) => current.map((v, i) => (i === index ? { ...v, handle: event.target.value } : v)))
                }
                placeholder="@ikn.rubber"
                aria-label={`Handle ${index + 1}`}
              />
              <input
                value={item.href}
                onChange={(event) =>
                  setSocial((current) => current.map((v, i) => (i === index ? { ...v, href: event.target.value } : v)))
                }
                placeholder="https://instagram.com/ikn.rubber"
                aria-label={`Tautan ${index + 1}`}
              />
              <button
                type="button"
                className="row-act row-act-danger"
                onClick={() => setSocial((current) => current.filter((_, i) => i !== index))}
              >
                Hapus
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-line btn-sm"
            onClick={() => setSocial((current) => [...current, { label: '', handle: '', href: '' }])}
          >
            <Icon name="plus" size={16} /> Tambah media sosial
          </button>
        </div>
      </AdminCard>

      <div className="row-actions" style={{ marginTop: 18 }}>
        <button type="button" className="btn btn-solid btn-sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Menyimpan...' : 'Simpan perubahan'} <Icon name="check" size={16} />
        </button>
      </div>
      {updatedAt && <p className="admin-note" style={{ marginTop: 10 }}>Terakhir diperbarui {formatDateTime(updatedAt)}</p>}
    </div>
  );
}
