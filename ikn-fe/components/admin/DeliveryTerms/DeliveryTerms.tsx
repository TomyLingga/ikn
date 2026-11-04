'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import Select from '@/components/Select';
import { AdminCard, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import { confirmDialog } from '@/components/ConfirmDialog';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import {
  deliveryFamilyLabels,
  deliveryMarketLabels,
  deliveryPricingLabels,
  taxProfileLabels,
  type AdminDeliveryTerm,
  type DeliveryTermPayload,
} from '@/lib/admin';
import type { DeliveryTermFamily, DeliveryTermMarket, DeliveryTermPricingMode, DeliveryTermTaxProfile } from '@/lib/types';

interface TermForm {
  code: string;
  name: I18n;
  description: I18n;
  family: DeliveryTermFamily;
  market: DeliveryTermMarket;
  pricingMode: DeliveryTermPricingMode;
  taxProfile: DeliveryTermTaxProfile;
  insuranceIncluded: boolean;
  loadingPort: string;
  requiresDestinationPort: boolean;
  isActive: boolean;
  sortOrder: string;
}

const emptyTerm = (sortOrder: number): TermForm => ({
  code: '',
  name: emptyI18n(),
  description: emptyI18n(),
  family: 'pickup',
  market: 'local',
  pricingMode: 'none',
  taxProfile: 'domestic',
  insuranceIncluded: false,
  loadingPort: '',
  requiresDestinationPort: false,
  isActive: true,
  sortOrder: String(sortOrder),
});

const termFormFrom = (row: AdminDeliveryTerm): TermForm => ({
  code: row.code,
  name: { ...row.name },
  description: row.description ? { ...row.description } : emptyI18n(),
  family: row.family,
  market: row.market,
  pricingMode: row.pricingMode,
  taxProfile: row.taxProfile ?? (row.market === 'export' ? 'export' : 'domestic'),
  insuranceIncluded: row.insuranceIncluded,
  loadingPort: row.loadingPort ?? '',
  requiresDestinationPort: row.requiresDestinationPort,
  isActive: row.isActive,
  sortOrder: String(row.sortOrder),
});

// PUT membutuhkan body lengkap (name/family/market/pricingMode wajib), jadi toggle aktif mengirim baris apa adanya + patch.
const payloadFrom = (row: AdminDeliveryTerm, patch: Partial<DeliveryTermPayload> = {}): DeliveryTermPayload => ({
  name: row.name,
  description: row.description ?? emptyI18n(),
  family: row.family,
  market: row.market,
  pricingMode: row.pricingMode,
  taxProfile: row.taxProfile ?? (row.market === 'export' ? 'export' : 'domestic'),
  insuranceIncluded: row.insuranceIncluded,
  loadingPort: row.loadingPort,
  requiresDestinationPort: row.requiresDestinationPort,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  ...patch,
});

// Tab "Serah terima" di halaman Ongkir (ASUMSI A-85): master cara serah terima (GET/POST /admin/delivery-terms,
// PUT/DELETE /admin/delivery-terms/{id}; hapus 409 bila sudah dipakai order). Titik ambil Loco = lokasi pabrik (ASUMSI A-90).
export default function DeliveryTerms() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [terms, setTerms] = useState<AdminDeliveryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ term: AdminDeliveryTerm | null } | null>(null);
  const [form, setForm] = useState<TermForm>(() => emptyTerm(0));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setTerms(await api<AdminDeliveryTerm[]>('/admin/delivery-terms'));
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

  function openForm(term: AdminDeliveryTerm | null) {
    setForm(term ? termFormFrom(term) : emptyTerm(terms.length));
    setFormErrors({});
    setFormError('');
    setModal({ term });
  }

  async function submitTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    const body: DeliveryTermPayload = {
      ...(modal.term ? {} : { code: form.code.trim().toLowerCase() }),
      name: { id: form.name.id.trim(), en: form.name.en.trim() },
      description: { id: form.description.id.trim(), en: form.description.en.trim() },
      family: form.family,
      market: form.market,
      pricingMode: form.pricingMode,
      taxProfile: form.taxProfile,
      insuranceIncluded: form.insuranceIncluded,
      loadingPort: form.loadingPort.trim() || null,
      requiresDestinationPort: form.requiresDestinationPort,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (modal.term) await api(`/admin/delivery-terms/${modal.term.id}`, { method: 'PUT', body });
      else await api('/admin/delivery-terms', { method: 'POST', body });
      await refresh();
      setNotice(modal.term ? t('Cara serah terima diperbarui.', 'Delivery term updated.') : t('Cara serah terima ditambahkan.', 'Delivery term added.'));
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

  async function toggleTerm(row: AdminDeliveryTerm) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/delivery-terms/${row.id}`, { method: 'PUT', body: payloadFrom(row, { isActive: !row.isActive }) });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeTerm(row: AdminDeliveryTerm) {
    if (!(await confirmDialog(t(`Hapus cara serah terima "${tr(row.name, lang)}"?`, `Delete delivery term "${tr(row.name, lang)}"?`)))) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/delivery-terms/${row.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Cara serah terima dihapus.', 'Delivery term deleted.'));
    } catch (err) {
      // 409 DELIVERY_TERM_IN_USE: pesan server menjelaskan bahwa term sudah dipakai order.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<AdminDeliveryTerm>[] = [
    {
      key: 'name',
      label: t('Nama', 'Name'),
      render: (row) => (
        <span>
          <strong>{tr(row.name, lang)}</strong>
          <small className="admin-cell-sub mono">
            {row.code}
            {row.ordersCount ? ` · ${row.ordersCount} order` : ''}
          </small>
        </span>
      ),
    },
    { key: 'family', label: t('Keluarga', 'Family'), render: (row) => deliveryFamilyLabels[row.family]?.[lang] || row.family },
    { key: 'market', label: t('Pasar', 'Market'), render: (row) => deliveryMarketLabels[row.market]?.[lang] || row.market },
    { key: 'pricing', label: t('Cara biaya', 'Pricing'), render: (row) => deliveryPricingLabels[row.pricingMode]?.[lang] || row.pricingMode },
    { key: 'tax', label: t('Pajak', 'Tax'), render: (row) => (row.taxProfile === 'export' ? t('Ekspor', 'Export') : t('Domestik', 'Domestic')) },
    { key: 'port', label: t('Pelabuhan muat', 'Loading port'), render: (row) => row.loadingPort || '—' },
    { key: 'sort', label: t('Urutan', 'Order'), align: 'right', render: (row) => String(row.sortOrder) },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge label={row.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={row.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (row) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(row) },
            row.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', disabled: busy, onClick: () => void toggleTerm(row) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', disabled: busy, onClick: () => void toggleTerm(row) },
            { label: t('Hapus', 'Delete'), tone: 'danger', disabled: busy, onClick: () => void removeTerm(row) },
          ]}
        />
      ),
    },
  ];

  const options = <K extends string>(labels: Record<K, { id: string; en: string }>) =>
    (Object.keys(labels) as K[]).map((key) => (
      <option key={key} value={key}>
        {labels[key][lang]}
      </option>
    ));

  return (
    <div>
      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <AdminCard
        title={t('Cara serah terima', 'Delivery terms')}
        desc={t(
          'Customer memilih salah satu cara aktif di awal checkout. Ambil di pabrik tidak memakai alamat dan ongkir; Diantar ke alamat memakai tarif di tab Zona & tarif.',
          'Customers pick one active term at the start of checkout. Factory pickup needs no address or shipping charge; door delivery uses the rates in the Zones & rates tab.',
        )}
        action={{ label: t('Tambah cara serah terima', 'Add delivery term'), icon: 'plus', onClick: () => openForm(null) }}
      >
        <DataTable
          columns={columns}
          rows={terms}
          rowKey="id"
          pagination={false}
          loading={loading}
          empty={loading ? t('Memuat cara serah terima...', 'Loading delivery terms...') : t('Belum ada cara serah terima; customer tidak bisa checkout sampai ada satu yang aktif.', 'No delivery terms yet; customers cannot check out until one is active.')}
        />
      </AdminCard>

      <p className="admin-field-hint" style={{ marginTop: 12 }}>
        <Icon name="pin" size={14} />{' '}
        {t(
          'Titik ambil Loco = pabrik asal tiap produk; atur alamat, titik peta, dan izin ambil di tab Lokasi pabrik.',
          'Loco pickup points are each product’s factory; set addresses, map pins and pickup permission in the Factory locations tab.',
        )}
      </p>

      {modal && (
        <AdminModal title={modal.term ? `${t('Edit cara serah terima', 'Edit delivery term')}: ${tr(modal.term.name, lang)}` : t('Tambah cara serah terima', 'Add delivery term')} onClose={() => setModal(null)}>
          <form className="admin-form" onSubmit={(e) => void submitTerm(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Kode', 'Code')} *</span>
                <input value={form.code} maxLength={32} disabled={!!modal.term} required={!modal.term} pattern="[a-z0-9][a-z0-9_-]*" className="mono" onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} placeholder="loco" />
                <small className="admin-field-hint">{modal.term ? t('Kode tidak bisa diubah setelah dibuat.', 'The code cannot be changed after creation.') : t('Huruf kecil, angka, tanda hubung atau garis bawah.', 'Lowercase letters, digits, hyphens or underscores.')}</small>
                {firstError(formErrors, 'code') && <small className="cms-field-error">{firstError(formErrors, 'code')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Urutan', 'Order')}</span>
                <input type="number" min={-1000} max={1000} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                {firstError(formErrors, 'sortOrder') && <small className="cms-field-error">{firstError(formErrors, 'sortOrder')}</small>}
              </label>
            </div>
            <I18nInput label={t('Nama', 'Name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required maxLength={120} placeholder={t('Loco (ambil di pabrik)', 'Loco (factory pickup)')} errorId={firstError(formErrors, 'name.id', 'name')} errorEn={firstError(formErrors, 'name.en')} />
            <I18nInput label={t('Deskripsi', 'Description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline rows={2} maxLength={500} errorId={firstError(formErrors, 'description.id', 'description')} errorEn={firstError(formErrors, 'description.en')} />
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Keluarga', 'Family')}</span>
                <Select value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value as DeliveryTermFamily })}>
                  {options(deliveryFamilyLabels)}
                </Select>
                {firstError(formErrors, 'family') && <small className="cms-field-error">{firstError(formErrors, 'family')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Pasar', 'Market')}</span>
                <Select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as DeliveryTermMarket })}>
                  {options(deliveryMarketLabels)}
                </Select>
                {firstError(formErrors, 'market') && <small className="cms-field-error">{firstError(formErrors, 'market')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Cara biaya', 'Pricing')}</span>
                <Select value={form.pricingMode} onChange={(e) => setForm({ ...form, pricingMode: e.target.value as DeliveryTermPricingMode })}>
                  {options(deliveryPricingLabels)}
                </Select>
                {firstError(formErrors, 'pricingMode') && <small className="cms-field-error">{firstError(formErrors, 'pricingMode')}</small>}
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Profil pajak', 'Tax profile')}</span>
                <Select value={form.taxProfile} onChange={(e) => setForm({ ...form, taxProfile: e.target.value as DeliveryTermTaxProfile })}>
                  {options(taxProfileLabels)}
                </Select>
                {firstError(formErrors, 'taxProfile') && <small className="cms-field-error">{firstError(formErrors, 'taxProfile')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Pelabuhan muat', 'Loading port')}</span>
                <input value={form.loadingPort} maxLength={120} onChange={(e) => setForm({ ...form, loadingPort: e.target.value })} placeholder={t('kosong untuk term lokal', 'empty for local terms')} />
                {firstError(formErrors, 'loadingPort') && <small className="cms-field-error">{firstError(formErrors, 'loadingPort')}</small>}
              </label>
            </div>
            <div className="admin-form-row admin-form-row-3">
              <label className="cms-check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" checked={form.insuranceIncluded} onChange={(e) => setForm({ ...form, insuranceIncluded: e.target.checked })} />
                <span>{t('Asuransi termasuk', 'Insurance included')}</span>
              </label>
              <label className="cms-check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" checked={form.requiresDestinationPort} onChange={(e) => setForm({ ...form, requiresDestinationPort: e.target.checked })} />
                <span>{t('Wajib pelabuhan tujuan', 'Destination port required')}</span>
              </label>
              <label className="cms-check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>{t('Aktif', 'Active')}</span>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : modal.term ? t('Simpan perubahan', 'Save changes') : t('Tambah cara serah terima', 'Add delivery term')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
