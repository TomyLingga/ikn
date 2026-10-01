'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { tr, type PagedMeta } from '@/lib/cms';
import { stockLabels } from '@/lib/commerce';
import { stockMovementLabels, type AdminProduct, type StockSummary } from '@/lib/admin';
import { formatDateTime } from '@/lib/format';
import Select from '@/components/Select';

interface StockPanelProps {
  product: AdminProduct;
  onClose: () => void;
  /** Dipanggil setelah mutasi agar daftar produk memuat ulang stok. */
  onChanged: () => void;
}

// Panel stok per produk: GET /admin/products/{id}/stock (ledger + ringkasan) dan POST (in|adjust).
export default function StockPanel({ product, onClose, onChanged }: StockPanelProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: 10, total: 0, lastPage: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState<'in' | 'adjust'>('in');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await api<{ data: StockSummary; meta: PagedMeta }>(`/admin/products/${product.id}/stock?page=${page}&perPage=10`, { raw: true });
      setSummary(payload.data);
      setMeta(payload.meta ?? { page: 1, perPage: 10, total: 0, lastPage: 1 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [product.id, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount === 0) {
      setFormError(t('Jumlah harus bilangan bulat selain 0.', 'Quantity must be a non-zero integer.'));
      return;
    }
    if (type === 'in' && amount < 0) {
      setFormError(t('Stok masuk harus positif; gunakan "Penyesuaian" untuk mengurangi.', 'Stock in must be positive; use "Adjustment" to reduce.'));
      return;
    }
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      await api(`/admin/products/${product.id}/stock`, { method: 'POST', body: { type, qty: amount, note: note.trim() || null } });
      setQty('');
      setNote('');
      setPage(1);
      setNotice(t('Mutasi stok tercatat.', 'Stock movement recorded.'));
      onChanged();
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormError(Object.values(err.errors)[0]?.[0] || err.message);
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const stockLabel = summary ? stockLabels[summary.stockStatus] || stockLabels.out_of_stock : null;

  return (
    <AdminModal title={`${t('Stok', 'Stock')}: ${tr(product.name, lang)} (${product.code})`} onClose={onClose} width={900}>
      <div className="admin-modal-body">
        {error && <p className="form-error">{error}</p>}

        <div className="admin-stat-grid">
          <div className="admin-stat">
            <span>{t('Stok fisik', 'On hand')}</span>
            <strong>{summary ? summary.stock : '—'}</strong>
          </div>
          <div className="admin-stat">
            <span>{t('Direservasi (order aktif)', 'Reserved (active orders)')}</span>
            <strong>{summary ? summary.reserved : '—'}</strong>
          </div>
          <div className="admin-stat">
            <span>{t('Tersedia', 'Available')}</span>
            <strong>{summary ? summary.available : '—'}</strong>
          </div>
          <div className="admin-stat">
            <span>{t('Status', 'Status')}</span>
            <strong>{stockLabel ? <StatusBadge label={stockLabel[lang]} tone={stockLabel.tone} small /> : '—'}</strong>
          </div>
        </div>

        <form className="admin-form admin-inline-form" onSubmit={(e) => void submit(e)}>
          <div className="admin-form-row admin-form-row-3">
            <label>
              <span className="field-label">{t('Jenis mutasi', 'Movement type')}</span>
              <Select value={type} onChange={(e) => setType(e.target.value as 'in' | 'adjust')}>
                <option value="in">{t('Stok masuk (produksi / pembelian)', 'Stock in (production / purchase)')}</option>
                <option value="adjust">{t('Penyesuaian (+/−, stock opname)', 'Adjustment (+/−, stock count)')}</option>
              </Select>
            </label>
            <label>
              <span className="field-label">{t('Jumlah', 'Quantity')} ({product.unit})</span>
              <input type="number" step={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder={type === 'adjust' ? t('mis. -5 atau 20', 'e.g. -5 or 20') : t('mis. 100', 'e.g. 100')} required />
            </label>
            <label>
              <span className="field-label">{t('Catatan', 'Note')}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('No. dokumen / alasan', 'Document no. / reason')} />
            </label>
          </div>
          {formError && (
            <p className="admin-form-error" role="alert">
              {formError}
            </p>
          )}
          {notice && (
            <p className="admin-toast" role="status">
              {notice}
            </p>
          )}
          <div className="admin-modal-actions" style={{ borderTop: 0, paddingTop: 0 }}>
            <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
              {saving ? t('Menyimpan...', 'Saving...') : t('Catat mutasi', 'Record movement')}
            </button>
          </div>
        </form>

        <h3 className="admin-subtitle">{t('Riwayat mutasi (ledger)', 'Movement history (ledger)')}</h3>
        {loading && !summary ? (
          <p className="admin-field-hint">{t('Memuat...', 'Loading...')}</p>
        ) : summary && summary.movements.length === 0 ? (
          <p className="admin-empty">{t('Belum ada mutasi.', 'No movements yet.')}</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('Waktu', 'Time')}</th>
                  <th>{t('Jenis', 'Type')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Jumlah', 'Qty')}</th>
                  <th>{t('Referensi', 'Reference')}</th>
                  <th>{t('Catatan', 'Note')}</th>
                  <th>{t('Oleh', 'By')}</th>
                </tr>
              </thead>
              <tbody>
                {summary?.movements.map((movement) => {
                  const label = stockMovementLabels[movement.type] || { id: movement.type, en: movement.type, tone: 'info' as const };
                  const signed = movement.type === 'commit' ? -Math.abs(movement.qty) : movement.qty;
                  return (
                    <tr key={movement.id}>
                      <td className="mono">{formatDateTime(movement.createdAt, lang)}</td>
                      <td>
                        <StatusBadge label={label[lang]} tone={label.tone} small />
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {signed > 0 ? `+${signed}` : signed}
                      </td>
                      <td>
                        {movement.referenceType === 'order' && movement.referenceId ? (
                          <span className="mono">order #{movement.referenceId}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{movement.note || '—'}</td>
                      <td>{movement.createdBy?.name || t('Sistem', 'System')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={meta} onPage={setPage} disabled={loading} />

        <p className="admin-field-hint" style={{ marginTop: 14 }}>
          {t(
            'Reservasi/pelepasan/terjual dicatat otomatis oleh sistem order; admin hanya mencatat stok masuk dan penyesuaian.',
            'Reserve/release/commit entries are written by the order system; admins only record stock in and adjustments.',
          )}{' '}
          <Link href={`/catalog/${product.slug}`} className="link" target="_blank">
            {t('Lihat halaman produk', 'View product page')}
          </Link>
        </p>
      </div>
    </AdminModal>
  );
}
