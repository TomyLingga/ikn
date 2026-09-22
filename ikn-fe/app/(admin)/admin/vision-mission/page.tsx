'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { AdminPageHead, AdminCard } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

// Pasangan nilai AKHLAK: [nama, deskripsi].
type AkhlakPair = [string, string];

interface VisionMissionData {
  vision?: unknown;
  misi?: unknown;
  akhlak?: unknown;
}

interface BlockResponse {
  key: string;
  data: VisionMissionData | null;
  updatedAt: string | null;
}

function parseData(data: VisionMissionData | null): { vision: string; misi: string[]; akhlak: AkhlakPair[] } {
  const vision = typeof data?.vision === 'string' ? data.vision : '';
  const misi = Array.isArray(data?.misi) ? (data!.misi as unknown[]).map((item) => String(item ?? '')) : [];
  const akhlak = Array.isArray(data?.akhlak)
    ? (data!.akhlak as unknown[]).map((entry) => {
        const pair = Array.isArray(entry) ? entry : [];
        return [String(pair[0] ?? ''), String(pair[1] ?? '')] as AkhlakPair;
      })
    : [];
  return { vision, misi, akhlak };
}

export default function AdminVisionMission() {
  const [vision, setVision] = useState('');
  const [misi, setMisi] = useState<string[]>([]);
  const [akhlak, setAkhlak] = useState<AkhlakPair[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const block = await api<BlockResponse>('/admin/blocks/vision-mission');
      const parsed = parseData(block.data);
      setVision(parsed.vision);
      setMisi(parsed.misi);
      setAkhlak(parsed.akhlak);
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

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = {
        vision: vision.trim(),
        misi: misi.map((item) => item.trim()).filter(Boolean),
        akhlak: akhlak
          .map((pair) => [pair[0].trim(), pair[1].trim()] as AkhlakPair)
          .filter((pair) => pair[0] || pair[1]),
      };
      await api('/admin/blocks/vision-mission', { method: 'PUT', body: { data } });
      setMisi(data.misi);
      setAkhlak(data.akhlak);
      setNotice('Visi & misi tersimpan.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <AdminPageHead title="Vision & Mission" desc="Kelola visi, misi, dan nilai AKHLAK perusahaan." />
        <p className="admin-note">Memuat data...</p>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHead title="Vision & Mission" desc="Kelola visi, misi, dan nilai AKHLAK perusahaan." />

      {notice && <div className="admin-toast" role="status">{notice}</div>}
      {error && <p className="form-error">{error}</p>}

      <AdminCard title="Visi">
        <div className="admin-form">
          <textarea
            rows={4}
            value={vision}
            onChange={(event) => setVision(event.target.value)}
            placeholder="Tuliskan visi perusahaan..."
          />
        </div>
      </AdminCard>

      <div style={{ height: 18 }} />

      <AdminCard title="Misi">
        <div className="admin-form">
          {misi.length === 0 && <p className="admin-note">Belum ada butir misi.</p>}
          {misi.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <input
                value={item}
                onChange={(event) =>
                  setMisi((current) => current.map((v, i) => (i === index ? event.target.value : v)))
                }
                placeholder={`Butir misi ${index + 1}`}
                aria-label={`Butir misi ${index + 1}`}
              />
              <button
                type="button"
                className="row-act row-act-danger"
                onClick={() => setMisi((current) => current.filter((_, i) => i !== index))}
              >
                Hapus
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-line btn-sm" onClick={() => setMisi((current) => [...current, ''])}>
            <Icon name="plus" size={16} /> Tambah butir misi
          </button>
        </div>
      </AdminCard>

      <div style={{ height: 18 }} />

      <AdminCard title="Nilai AKHLAK">
        <div className="admin-form">
          {akhlak.length === 0 && <p className="admin-note">Belum ada nilai AKHLAK.</p>}
          {akhlak.map((pair, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <input
                value={pair[0]}
                onChange={(event) =>
                  setAkhlak((current) =>
                    current.map((row, i) => (i === index ? ([event.target.value, row[1]] as AkhlakPair) : row))
                  )
                }
                placeholder="Nama nilai"
                aria-label={`Nama nilai ${index + 1}`}
              />
              <input
                value={pair[1]}
                onChange={(event) =>
                  setAkhlak((current) =>
                    current.map((row, i) => (i === index ? ([row[0], event.target.value] as AkhlakPair) : row))
                  )
                }
                placeholder="Deskripsi nilai"
                aria-label={`Deskripsi nilai ${index + 1}`}
              />
              <button
                type="button"
                className="row-act row-act-danger"
                onClick={() => setAkhlak((current) => current.filter((_, i) => i !== index))}
              >
                Hapus
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-line btn-sm" onClick={() => setAkhlak((current) => [...current, ['', '']])}>
            <Icon name="plus" size={16} /> Tambah nilai
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
