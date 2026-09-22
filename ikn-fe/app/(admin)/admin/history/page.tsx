'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { AdminPageHead, AdminCard } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

// Baris timeline: [tahun, judul, teks].
type TimelineRow = [string, string, string];

interface BlockResponse {
  key: string;
  data: { timeline?: unknown } | null;
  updatedAt: string | null;
}

function parseTimeline(data: BlockResponse['data']): TimelineRow[] {
  if (!data || !Array.isArray(data.timeline)) return [];
  return (data.timeline as unknown[]).map((entry) => {
    const row = Array.isArray(entry) ? entry : [];
    return [String(row[0] ?? ''), String(row[1] ?? ''), String(row[2] ?? '')] as TimelineRow;
  });
}

export default function AdminHistory() {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const block = await api<BlockResponse>('/admin/blocks/history');
      setRows(parseTimeline(block.data));
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

  function updateRow(index: number, field: 0 | 1 | 2, value: string) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = [...row] as TimelineRow;
        next[field] = value;
        return next;
      })
    );
  }

  function addRow() {
    setRows((current) => [...current, ['', '', '']]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const timeline = rows
        .map((row) => [row[0].trim(), row[1].trim(), row[2].trim()] as TimelineRow)
        .filter((row) => row[0] || row[1] || row[2]);
      await api('/admin/blocks/history', { method: 'PUT', body: { data: { timeline } } });
      setRows(timeline);
      setNotice('Tonggak sejarah tersimpan.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <AdminPageHead
        title="History"
        desc="Kelola tonggak sejarah perusahaan yang tampil di halaman Tentang."
        action={{ label: 'Tambah tonggak', icon: 'plus', onClick: addRow }}
      />

      {notice && <div className="admin-toast" role="status">{notice}</div>}
      {error && <p className="form-error">{error}</p>}

      <AdminCard title="Tonggak sejarah">
        {loading ? (
          <p className="admin-note">Memuat data...</p>
        ) : (
          <div className="admin-form">
            {rows.length === 0 && <p className="admin-note">Belum ada tonggak sejarah. Tambahkan baris baru.</p>}
            {rows.map((row, index) => (
              <div
                key={index}
                style={{ display: 'grid', gridTemplateColumns: '110px 220px 1fr auto', gap: 12, alignItems: 'center', marginBottom: 12 }}
              >
                <input
                  className="mono"
                  value={row[0]}
                  onChange={(event) => updateRow(index, 0, event.target.value)}
                  placeholder="Tahun"
                  aria-label={`Tahun baris ${index + 1}`}
                />
                <input
                  value={row[1]}
                  onChange={(event) => updateRow(index, 1, event.target.value)}
                  placeholder="Judul"
                  aria-label={`Judul baris ${index + 1}`}
                />
                <input
                  value={row[2]}
                  onChange={(event) => updateRow(index, 2, event.target.value)}
                  placeholder="Deskripsi singkat"
                  aria-label={`Deskripsi baris ${index + 1}`}
                />
                <button type="button" className="row-act row-act-danger" onClick={() => removeRow(index)}>
                  Hapus
                </button>
              </div>
            ))}
            <div className="row-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-line btn-sm" onClick={addRow}>
                <Icon name="plus" size={16} /> Tambah baris
              </button>
              <button type="button" className="btn btn-solid btn-sm" disabled={saving} onClick={() => void save()}>
                {saving ? 'Menyimpan...' : 'Simpan perubahan'} <Icon name="check" size={16} />
              </button>
            </div>
            {updatedAt && <p className="admin-note" style={{ marginTop: 10 }}>Terakhir diperbarui {formatDateTime(updatedAt)}</p>}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
