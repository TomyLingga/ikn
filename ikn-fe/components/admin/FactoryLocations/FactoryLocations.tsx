'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminCard, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import GeoPicker from '@/components/admin/cms/GeoPicker';
import { confirmDialog } from '@/components/ConfirmDialog';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import type { AdminFactoryLocation, FactoryLocationPayload } from '@/lib/admin';

interface FactoryForm {
  code: string;
  name: I18n;
  address: string;
  lat: number | null;
  lng: number | null;
  allowsPickup: boolean;
  sortOrder: string;
}

const emptyForm = (sortOrder: number): FactoryForm => ({
  code: '',
  name: emptyI18n(),
  address: '',
  lat: null,
  lng: null,
  allowsPickup: true,
  sortOrder: String(sortOrder),
});

const formFrom = (row: AdminFactoryLocation): FactoryForm => ({
  code: row.code,
  name: { ...row.name },
  address: row.address ?? '',
  lat: row.lat,
  lng: row.lng,
  allowsPickup: row.allowsPickup,
  sortOrder: String(row.sortOrder),
});

// Tab "Lokasi pabrik" di halaman Ongkir (ASUMSI A-90): titik asal ongkir Franco per km sekaligus titik ambil Loco.
// GET/POST /admin/factory-locations, PUT/DELETE /admin/factory-locations/{id}; PUT = penggantian penuh (lat/lng selalu
// dikirim), hapus 409 FACTORY_LOCATION_IN_USE bila masih dipakai produk atau tinggal satu baris.
export default function FactoryLocations() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [rows, setRows] = useState<AdminFactoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ row: AdminFactoryLocation | null } | null>(null);
  const [form, setForm] = useState<FactoryForm>(() => emptyForm(1));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<AdminFactoryLocation[]>('/admin/factory-locations'));
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
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openForm(row: AdminFactoryLocation | null) {
    const nextOrder = rows.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1;
    setForm(row ? formFrom(row) : emptyForm(nextOrder));
    setFormErrors({});
    setFormError('');
    setModal({ row });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    const hasPin = form.lat !== null && form.lng !== null;
    const body: FactoryLocationPayload = {
      ...(modal.row ? {} : { code: form.code.trim().toLowerCase() }),
      name: { id: form.name.id.trim(), en: form.name.en.trim() },
      address: form.address.trim(),
      lat: hasPin ? form.lat : null,
      lng: hasPin ? form.lng : null,
      allowsPickup: form.allowsPickup,
      sortOrder: form.sortOrder.trim() === '' ? null : Number(form.sortOrder) || 0,
    };
    try {
      if (modal.row) await api(`/admin/factory-locations/${modal.row.id}`, { method: 'PUT', body });
      else await api('/admin/factory-locations', { method: 'POST', body });
      await refresh();
      setNotice(modal.row ? t('Lokasi pabrik diperbarui.', 'Factory location updated.') : t('Lokasi pabrik ditambahkan.', 'Factory location added.'));
      setModal(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(err.errors);
        setFormError(err.message);
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: AdminFactoryLocation) {
    const name = tr(row.name, lang);
    const message = row.productsCount
      ? t(`Hapus lokasi pabrik "${name}"? Masih ada ${row.productsCount} produk yang memakainya, jadi penghapusan akan ditolak sampai produknya dipindah.`, `Delete factory location "${name}"? ${row.productsCount} products still use it, so the delete will be refused until they are moved.`)
      : t(`Hapus lokasi pabrik "${name}"?`, `Delete factory location "${name}"?`);
    if (!(await confirmDialog(message))) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/factory-locations/${row.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Lokasi pabrik dihapus.', 'Factory location deleted.'));
    } catch (err) {
      // 409 FACTORY_LOCATION_IN_USE: pesan server menjelaskan (dipakai produk, atau baris terakhir).
      if (err instanceof ApiError && err.status === 409) {
        setError(
          err.message ||
            t('Lokasi pabrik masih dipakai produk atau tinggal satu; pindahkan produknya ke pabrik lain dulu.', 'The factory is still used by products or is the last one; move its products to another factory first.'),
        );
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<AdminFactoryLocation>[] = [
    {
      key: 'name',
      label: t('Nama', 'Name'),
      render: (row) => (
        <span>
          <strong>{tr(row.name, lang)}</strong>{' '}
          {row.isDefault && <StatusBadge label={t('Bawaan', 'Default')} tone="info" small />}
        </span>
      ),
    },
    { key: 'code', label: t('Kode', 'Code'), render: (row) => <span className="mono">{row.code}</span> },
    { key: 'address', label: t('Alamat', 'Address'), render: (row) => <span className="admin-cell-sub" style={{ whiteSpace: 'normal' }}>{row.address || '-'}</span> },
    {
      key: 'geo',
      label: t('Titik peta', 'Map pin'),
      render: (row) =>
        row.lat !== null && row.lng !== null ? (
          <span className="mono">{`${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`}</span>
        ) : (
          <StatusBadge label={t('Belum diatur', 'Not set')} tone="warn" small />
        ),
    },
    {
      key: 'pickup',
      label: t('Ambil Loco', 'Loco pickup'),
      render: (row) => <StatusBadge label={row.allowsPickup ? t('Boleh', 'Allowed') : t('Tidak', 'No')} tone={row.allowsPickup ? 'ok' : 'bad'} small />,
    },
    { key: 'sort', label: t('Urutan', 'Order'), align: 'right', render: (row) => String(row.sortOrder) },
    { key: 'products', label: t('Produk', 'Products'), align: 'right', render: (row) => String(row.productsCount ?? 0) },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (row) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(row) },
            { label: t('Hapus', 'Delete'), tone: 'danger', disabled: busy, onClick: () => void remove(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <AdminCard
        title={t('Lokasi pabrik', 'Factory locations')}
        desc={t(
          'Setiap produk dikirim dari atau diambil di pabrik asalnya. Titik peta dipakai tarif per km (Franco); pabrik yang boleh diambil menjadi titik ambil Loco. Pabrik urutan pertama (Bawaan) dipakai untuk produk tanpa pabrik asal.',
          'Each product ships from or is collected at its own factory. The map pin feeds per-km rates (Franco); factories that allow pickup become Loco pickup points. The first factory (Default) applies to products without a factory.',
        )}
        action={{ label: t('Tambah pabrik', 'Add factory'), icon: 'plus', onClick: () => openForm(null) }}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="id"
          pagination={false}
          loading={loading}
          empty={loading ? t('Memuat lokasi pabrik...', 'Loading factory locations...') : t('Belum ada lokasi pabrik; tarif per km dan Loco butuh minimal satu.', 'No factory locations yet; per-km rates and Loco need at least one.')}
        />
      </AdminCard>

      {modal && (
        <AdminModal title={modal.row ? `${t('Edit lokasi pabrik', 'Edit factory location')}: ${tr(modal.row.name, lang)}` : t('Tambah lokasi pabrik', 'Add factory location')} onClose={() => setModal(null)} width={760}>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Kode pabrik', 'Factory code')} *</span>
                <input
                  value={form.code}
                  maxLength={32}
                  disabled={!!modal.row}
                  required={!modal.row}
                  pattern="[a-z0-9][a-z0-9\-]*"
                  className="mono"
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                  placeholder="tanjung-morawa"
                />
                <small className="admin-field-hint">{modal.row ? t('Kode tidak bisa diubah setelah dibuat.', 'The code cannot be changed after creation.') : t('Huruf kecil, angka, dan tanda hubung.', 'Lowercase letters, digits and hyphens.')}</small>
                {firstError(formErrors, 'code') && <small className="cms-field-error">{firstError(formErrors, 'code')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Urutan pabrik', 'Factory order')}</span>
                <input type="number" min={0} max={1000} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder={t('kosong = di akhir', 'empty = last')} />
                <small className="admin-field-hint">{t('Urutan pertama menjadi pabrik bawaan.', 'The first one becomes the default factory.')}</small>
                {firstError(formErrors, 'sortOrder') && <small className="cms-field-error">{firstError(formErrors, 'sortOrder')}</small>}
              </label>
            </div>
            <I18nInput
              label={t('Nama pabrik', 'Factory name')}
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
              maxLength={120}
              placeholder={t('Pabrik Tanjung Morawa', 'Tanjung Morawa Factory')}
              errorId={firstError(formErrors, 'name.id', 'name')}
              errorEn={firstError(formErrors, 'name.en')}
            />
            <label>
              <span className="field-label">{t('Alamat pabrik', 'Factory address')} *</span>
              <input value={form.address} maxLength={255} required onChange={(e) => setForm({ ...form, address: e.target.value })} />
              {firstError(formErrors, 'address') && <small className="cms-field-error">{firstError(formErrors, 'address')}</small>}
            </label>
            <div className="cms-field">
              <span className="field-label">{t('Titik peta pabrik', 'Factory map pin')}</span>
              <GeoPicker value={{ lat: form.lat, lng: form.lng }} onChange={(geo) => setForm({ ...form, lat: geo.lat, lng: geo.lng })} />
              <small className="admin-field-hint">
                {t('Tanpa titik peta, tarif per km tidak ditawarkan untuk keranjang berisi produk pabrik ini.', 'Without a map pin, per-km rates are not offered for carts containing this factory’s products.')}
              </small>
              {(firstError(formErrors, 'lat') || firstError(formErrors, 'lng')) && <small className="cms-field-error">{firstError(formErrors, 'lat') || firstError(formErrors, 'lng')}</small>}
            </div>
            <div className="cms-field">
              <span className="field-label">{t('Boleh diambil (Loco)', 'Pickup allowed (Loco)')}</span>
              <label className="cms-check">
                <input type="checkbox" checked={form.allowsPickup} onChange={(e) => setForm({ ...form, allowsPickup: e.target.checked })} />
                <span>{t('Customer boleh mengambil sendiri barang dari pabrik ini', 'Customers may collect goods from this factory')}</span>
              </label>
              {firstError(formErrors, 'allowsPickup') && <small className="cms-field-error">{firstError(formErrors, 'allowsPickup')}</small>}
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : modal.row ? t('Simpan perubahan', 'Save changes') : t('Tambah pabrik', 'Add factory')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
