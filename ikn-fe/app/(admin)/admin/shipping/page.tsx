'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, RowActions } from '@/components/admin/AdminPage';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import GeoPicker from '@/components/admin/cms/GeoPicker';
import RegionPicker, { useRegionNames } from '@/components/admin/RegionPicker';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import {
  numberOrNull,
  previewShippingAmount,
  regionLevelLabels,
  shippingRateTypeLabels,
  type ShippingOrigin,
  type ShippingRateRow,
  type ShippingRateType,
  type ShippingZoneRow,
  type ZoneRegionRef,
} from '@/lib/admin';
import { formatIDR } from '@/lib/format';
import { confirmDialog } from '@/components/ConfirmDialog';

interface ZoneForm {
  name: I18n;
  priority: string;
  isActive: boolean;
  isDefault: boolean;
  regions: ZoneRegionRef[];
}

interface RateForm {
  name: I18n;
  type: ShippingRateType;
  baseAmount: string;
  perKmAmount: string;
  perKgAmount: string;
  perM3Amount: string;
  minAmount: string;
  freeAbove: string;
  eta: I18n;
  isActive: boolean;
  sortOrder: string;
}

type Modal = { type: 'zone'; zone: ShippingZoneRow | null } | { type: 'rate'; zone: ShippingZoneRow; rate: ShippingRateRow | null } | null;

const emptyZone = (): ZoneForm => ({ name: emptyI18n(), priority: '10', isActive: true, isDefault: false, regions: [] });
const zoneFormFrom = (z: ShippingZoneRow): ZoneForm => ({ name: { ...z.name }, priority: String(z.priority), isActive: z.isActive, isDefault: z.isDefault, regions: [...z.regions] });
const emptyRate = (sortOrder: number): RateForm => ({
  name: emptyI18n(),
  type: 'calculated',
  baseAmount: '',
  perKmAmount: '0',
  perKgAmount: '0',
  perM3Amount: '0',
  minAmount: '0',
  freeAbove: '',
  eta: emptyI18n(),
  isActive: true,
  sortOrder: String(sortOrder),
});
const rateFormFrom = (r: ShippingRateRow): RateForm => ({
  name: { ...r.name },
  type: r.type,
  baseAmount: String(r.baseAmount),
  perKmAmount: String(r.perKmAmount ?? 0),
  perKgAmount: String(r.perKgAmount),
  perM3Amount: String(r.perM3Amount ?? 0),
  minAmount: String(r.minAmount),
  freeAbove: r.freeAbove === null ? '' : String(r.freeAbove),
  eta: r.eta ? { ...r.eta } : emptyI18n(),
  isActive: r.isActive,
  sortOrder: String(r.sortOrder),
});

function ZoneRegions({ regions, lang }: { regions: ZoneRegionRef[]; lang: 'id' | 'en' }) {
  const names = useRegionNames(regions);
  if (regions.length === 0) {
    return <span className="admin-field-hint">{lang === 'en' ? 'No regions (fallback zone)' : 'Tanpa wilayah (zona cadangan)'}</span>;
  }
  return (
    <div className="admin-region-chips">
      {regions.map((r) => (
        <span key={r.code} className="admin-chip admin-chip-static" title={`${regionLevelLabels[r.level]?.[lang] || r.level} · ${r.code}`}>
          {names[r.code] || r.code}
          <small> · {regionLevelLabels[r.level]?.[lang] || r.level}</small>
        </span>
      ))}
    </div>
  );
}

// Ongkir per zona wilayah: GET/POST /admin/shipping-zones, PUT/DELETE /admin/shipping-zones/{id},
// GET/POST /admin/shipping-zones/{id}/rates, PUT/DELETE /admin/shipping-rates/{id}.
export default function AdminShipping() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [zones, setZones] = useState<ShippingZoneRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [zoneForm, setZoneForm] = useState<ZoneForm>(emptyZone);
  const [rateForm, setRateForm] = useState<RateForm>(() => emptyRate(0));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState<ShippingOrigin | null>(null);
  const [originOpen, setOriginOpen] = useState(false);
  const [originErrors, setOriginErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState({ km: '100', kg: '50', m3: '0.25' });

  const refresh = useCallback(async () => {
    setError('');
    try {
      const list = await api<ShippingZoneRow[]>('/admin/shipping-zones');
      setZones(list);
      setSelectedId((current) => (current && list.some((z) => z.id === current) ? current : list[0]?.id ?? null));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    api<ShippingOrigin>('/admin/shipping-origin')
      .then(setOrigin)
      .catch(() => setOrigin(null));
  }, [refresh]);

  async function saveOrigin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!origin || saving) return;
    setSaving(true);
    setOriginErrors({});
    try {
      setOrigin(await api<ShippingOrigin>('/admin/shipping-origin', { method: 'PUT', body: origin }));
      setNotice(t('Titik asal pengiriman disimpan.', 'Shipping origin saved.'));
      setOriginOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setOriginErrors(err.errors);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = zones.find((z) => z.id === selectedId) ?? null;

  function openZone(zone: ShippingZoneRow | null) {
    setZoneForm(zone ? zoneFormFrom(zone) : emptyZone());
    setFormErrors({});
    setFormError('');
    setModal({ type: 'zone', zone });
  }

  function openRate(zone: ShippingZoneRow, rate: ShippingRateRow | null) {
    setRateForm(rate ? rateFormFrom(rate) : emptyRate(zone.rates.length));
    setFormErrors({});
    setFormError('');
    setModal({ type: 'rate', zone, rate });
  }

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 422) {
      setFormErrors(err.errors);
      setFormError(err.message);
    } else {
      setFormError(errorMessage(err));
    }
  }

  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== 'zone' || saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    const body = {
      name: { id: zoneForm.name.id.trim(), en: zoneForm.name.en.trim() },
      priority: Number(zoneForm.priority) || 0,
      isActive: zoneForm.isActive,
      isDefault: zoneForm.isDefault,
      regions: zoneForm.regions,
    };
    try {
      const saved = modal.zone
        ? await api<ShippingZoneRow>(`/admin/shipping-zones/${modal.zone.id}`, { method: 'PUT', body })
        : await api<ShippingZoneRow>('/admin/shipping-zones', { method: 'POST', body });
      await refresh();
      setSelectedId(saved.id);
      setNotice(modal.zone ? t('Zona diperbarui.', 'Zone updated.') : t('Zona ditambahkan.', 'Zone added.'));
      setModal(null);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeZone(zone: ShippingZoneRow) {
    if (!await confirmDialog(t(`Hapus zona "${tr(zone.name, lang)}" beserta ${zone.rates.length} tarifnya?`, `Delete zone "${tr(zone.name, lang)}" and its ${zone.rates.length} rates?`))) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/shipping-zones/${zone.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Zona dihapus.', 'Zone deleted.'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleZone(zone: ShippingZoneRow, patch: Partial<Pick<ShippingZoneRow, 'isActive' | 'isDefault'>>) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/shipping-zones/${zone.id}`, { method: 'PUT', body: { name: zone.name, priority: zone.priority, isActive: zone.isActive, isDefault: zone.isDefault, ...patch } });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== 'rate' || saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    const body = {
      name: { id: rateForm.name.id.trim(), en: rateForm.name.en.trim() },
      type: rateForm.type,
      baseAmount: Number(rateForm.baseAmount) || 0,
      perKmAmount: rateForm.type === 'calculated' ? Number(rateForm.perKmAmount) || 0 : 0,
      perKgAmount: rateForm.type === 'calculated' ? Number(rateForm.perKgAmount) || 0 : 0,
      perM3Amount: rateForm.type === 'calculated' ? Number(rateForm.perM3Amount) || 0 : 0,
      minAmount: Number(rateForm.minAmount) || 0,
      freeAbove: numberOrNull(rateForm.freeAbove),
      eta: { id: rateForm.eta.id.trim(), en: rateForm.eta.en.trim() },
      isActive: rateForm.isActive,
      sortOrder: Number(rateForm.sortOrder) || 0,
    };
    try {
      if (modal.rate) {
        await api(`/admin/shipping-rates/${modal.rate.id}`, { method: 'PUT', body });
      } else {
        await api(`/admin/shipping-zones/${modal.zone.id}/rates`, { method: 'POST', body });
      }
      await refresh();
      setNotice(modal.rate ? t('Tarif diperbarui.', 'Rate updated.') : t('Tarif ditambahkan.', 'Rate added.'));
      setModal(null);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRate(rate: ShippingRateRow) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/shipping-rates/${rate.id}`, {
        method: 'PUT',
        body: { name: rate.name, type: rate.type, baseAmount: rate.baseAmount, perKmAmount: rate.perKmAmount, perKgAmount: rate.perKgAmount, perM3Amount: rate.perM3Amount, minAmount: rate.minAmount, freeAbove: rate.freeAbove, eta: rate.eta, isActive: !rate.isActive, sortOrder: rate.sortOrder },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeRate(rate: ShippingRateRow) {
    if (!await confirmDialog(t(`Hapus tarif "${tr(rate.name, lang)}"?`, `Delete rate "${tr(rate.name, lang)}"?`))) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/shipping-rates/${rate.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Tarif dihapus.', 'Rate deleted.'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const rateSummary = (r: ShippingRateRow) => {
    if (r.type === 'flat') return formatIDR(r.baseAmount);
    const parts = [formatIDR(r.baseAmount)];
    if (r.perKmAmount > 0) parts.push(`${formatIDR(r.perKmAmount)}/km`);
    if (r.perKgAmount > 0) parts.push(`${formatIDR(r.perKgAmount)}/kg`);
    if (r.perM3Amount > 0) parts.push(`${formatIDR(r.perM3Amount)}/m³`);
    return parts.join(' + ');
  };
  const rateNumbers = {
    type: rateForm.type,
    baseAmount: Number(rateForm.baseAmount) || 0,
    perKmAmount: Number(rateForm.perKmAmount) || 0,
    perKgAmount: Number(rateForm.perKgAmount) || 0,
    perM3Amount: Number(rateForm.perM3Amount) || 0,
    minAmount: Number(rateForm.minAmount) || 0,
  };
  const previewResult = previewShippingAmount(rateNumbers, { km: Number(preview.km) || 0, kg: Number(preview.kg) || 0, m3: Number(preview.m3) || 0 });
  const originSet = origin !== null && origin.lat !== null && origin.lng !== null;

  return (
    <div>
      <AdminPageHead
        title={t('Ongkos Kirim', 'Shipping Rates')}
        desc={t(
          'Zona wilayah menentukan tarif yang ditawarkan; tarif "Dihitung" memakai tiga parameter: jarak (km dari titik asal ke titik peta alamat), berat (kg), dan volume (m³) pesanan.',
          'Region zones decide which rates are offered; "Calculated" rates use three parameters: distance (km from the origin to the address map pin), weight (kg), and volume (m³) of the order.',
        )}
        action={{ label: t('Tambah zona', 'Add zone'), icon: 'plus', onClick: () => openZone(null) }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      {origin && (
        <div className="admin-card ship-origin">
          <div className="ship-origin-head">
            <span className="ship-origin-icon">
              <Icon name="pin" size={18} />
            </span>
            <div>
              <strong>{t('Titik asal pengiriman', 'Shipping origin')}</strong>
              <small>
                {originSet
                  ? `${origin.label || t('Tanpa nama', 'Unnamed')} · ${origin.lat?.toFixed(5)}, ${origin.lng?.toFixed(5)} · ${t('faktor jalan', 'road factor')} ×${origin.roadFactor}`
                  : t('Belum diatur — tarif per km tidak ditawarkan sampai titik asal diisi.', 'Not set — per-km rates are not offered until an origin is set.')}
              </small>
            </div>
            <button type="button" className="btn btn-line btn-sm" onClick={() => setOriginOpen((v) => !v)}>
              {originOpen ? t('Tutup', 'Close') : t('Ubah titik asal', 'Edit origin')}
            </button>
          </div>
          {originOpen && (
            <form className="admin-form ship-origin-form" onSubmit={(e) => void saveOrigin(e)}>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">{t('Nama lokasi', 'Location name')}</span>
                  <input value={origin.label} maxLength={120} onChange={(e) => setOrigin({ ...origin, label: e.target.value })} placeholder={t('mis. Pabrik Resiprene', 'e.g. Resiprene plant')} />
                </label>
                <label>
                  <span className="field-label">{t('Faktor jalan', 'Road factor')}</span>
                  <input type="number" min={1} max={3} step={0.05} value={origin.roadFactor} onChange={(e) => setOrigin({ ...origin, roadFactor: Number(e.target.value) })} />
                  <small className="admin-field-hint">
                    {t('Jarak jalan ≈ jarak garis lurus × faktor ini (1,3 cocok untuk jalan darat Sumatra).', 'Road distance ≈ straight-line distance × this factor (1.3 suits overland roads).')}
                  </small>
                  {firstError(originErrors, 'roadFactor') && <small className="cms-field-error">{firstError(originErrors, 'roadFactor')}</small>}
                </label>
              </div>
              <GeoPicker value={{ lat: origin.lat, lng: origin.lng }} onChange={(geo) => setOrigin({ ...origin, lat: geo.lat, lng: geo.lng })} />
              {(firstError(originErrors, 'lat') || firstError(originErrors, 'lng')) && <small className="cms-field-error">{firstError(originErrors, 'lat') || firstError(originErrors, 'lng')}</small>}
              <div className="admin-modal-actions">
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                  {saving ? t('Menyimpan...', 'Saving...') : t('Simpan titik asal', 'Save origin')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <p className="admin-field-hint">{t('Memuat zona...', 'Loading zones...')}</p>
      ) : zones.length === 0 ? (
        <div className="admin-empty">{t('Belum ada zona ongkir. Tambahkan zona (mis. "Jawa", "Sumatera Utara", "Indonesia lainnya").', 'No shipping zones yet. Add zones (e.g. "Java", "North Sumatra", "Rest of Indonesia").')}</div>
      ) : (
        <div className="admin-split">
          <aside className="admin-split-side">
            <ul className="admin-zone-list">
              {zones.map((zone) => (
                <li key={zone.id}>
                  <button type="button" className={`admin-zone-item ${zone.id === selectedId ? 'is-active' : ''}`} onClick={() => setSelectedId(zone.id)}>
                    <span className="admin-zone-title">
                      <strong>{tr(zone.name, lang)}</strong>
                      <span className="admin-zone-badges">
                        {zone.isDefault && <StatusBadge label={t('Cadangan', 'Fallback')} tone="info" small />}
                        {!zone.isActive && <StatusBadge label={t('Nonaktif', 'Inactive')} tone="bad" small />}
                      </span>
                    </span>
                    <small>
                      {t('Prioritas', 'Priority')} {zone.priority} · {zone.regions.length} {t('wilayah', 'regions')} · {zone.rates.length} {t('tarif', 'rates')}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            <p className="admin-field-hint">
              {t('Bila alamat cocok dengan beberapa zona, wilayah paling spesifik menang, lalu prioritas tertinggi.', 'If an address matches several zones, the most specific region wins, then the highest priority.')}
            </p>
          </aside>

          <section className="admin-split-main">
            {selected && (
              <>
                <div className="admin-card">
                  <div className="admin-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <h2 className="admin-card-title" style={{ margin: 0 }}>
                        {tr(selected.name, lang)}
                      </h2>
                      <p className="admin-desc" style={{ marginTop: 4 }}>
                        {t('Prioritas', 'Priority')} {selected.priority}
                        {selected.isDefault ? ` · ${t('zona cadangan', 'fallback zone')}` : ''}
                        {!selected.isActive ? ` · ${t('nonaktif', 'inactive')}` : ''}
                      </p>
                    </div>
                    <RowActions
                      actions={[
                        { label: t('Edit zona', 'Edit zone'), onClick: () => openZone(selected) },
                        selected.isActive
                          ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', disabled: busy, onClick: () => void toggleZone(selected, { isActive: false }) }
                          : { label: t('Aktifkan', 'Activate'), tone: 'success', disabled: busy, onClick: () => void toggleZone(selected, { isActive: true }) },
                        ...(selected.isDefault ? [] : [{ label: t('Jadikan cadangan', 'Set as fallback'), disabled: busy, onClick: () => void toggleZone(selected, { isDefault: true }) }]),
                        { label: t('Hapus', 'Delete'), tone: 'danger', disabled: busy, onClick: () => void removeZone(selected) },
                      ]}
                    />
                  </div>
                  <span className="field-label">{t('Cakupan wilayah', 'Coverage')}</span>
                  <div style={{ marginTop: 8 }}>
                    <ZoneRegions regions={selected.regions} lang={lang} />
                  </div>
                </div>

                <div className="admin-card" style={{ marginTop: 18 }}>
                  <div className="admin-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <h2 className="admin-card-title" style={{ margin: 0 }}>
                        {t('Tarif pengiriman', 'Delivery rates')}
                      </h2>
                      <p className="admin-desc" style={{ marginTop: 4 }}>
                        {t('Customer memilih salah satu tarif aktif saat checkout.', 'Customers pick one active rate at checkout.')}
                      </p>
                    </div>
                    <button type="button" className="btn btn-solid btn-sm" onClick={() => openRate(selected, null)}>
                      <Icon name="plus" size={15} /> {t('Tambah tarif', 'Add rate')}
                    </button>
                  </div>
                  {selected.rates.length === 0 ? (
                    <div className="admin-empty">{t('Belum ada tarif di zona ini; customer di wilayah ini tidak bisa checkout.', 'No rates in this zone yet; customers in these regions cannot check out.')}</div>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('Nama', 'Name')}</th>
                            <th>{t('Jenis', 'Type')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Tarif', 'Rate')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Minimum', 'Minimum')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Gratis di atas', 'Free above')}</th>
                            <th>{t('Estimasi', 'ETA')}</th>
                            <th>Status</th>
                            <th>{t('Aksi', 'Action')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.rates.map((rate) => (
                            <tr key={rate.id}>
                              <td>
                                <strong>{tr(rate.name, lang)}</strong>
                                <small className="admin-cell-sub mono">#{rate.id} · {t('urutan', 'order')} {rate.sortOrder}</small>
                              </td>
                              <td>{shippingRateTypeLabels[rate.type]?.[lang] || rate.type}</td>
                              <td style={{ textAlign: 'right' }}>{rateSummary(rate)}</td>
                              <td style={{ textAlign: 'right' }}>{rate.minAmount > 0 ? formatIDR(rate.minAmount) : '—'}</td>
                              <td style={{ textAlign: 'right' }}>{rate.freeAbove !== null ? formatIDR(rate.freeAbove) : '—'}</td>
                              <td>{rate.eta ? tr(rate.eta, lang) : '—'}</td>
                              <td>
                                <StatusBadge label={rate.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={rate.isActive ? 'ok' : 'bad'} small />
                              </td>
                              <td>
                                <RowActions
                                  actions={[
                                    { label: 'Edit', onClick: () => openRate(selected, rate) },
                                    rate.isActive
                                      ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', disabled: busy, onClick: () => void toggleRate(rate) }
                                      : { label: t('Aktifkan', 'Activate'), tone: 'success', disabled: busy, onClick: () => void toggleRate(rate) },
                                    { label: t('Hapus', 'Delete'), tone: 'danger', disabled: busy, onClick: () => void removeRate(rate) },
                                  ]}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {modal?.type === 'zone' && (
        <AdminModal title={modal.zone ? `${t('Edit zona', 'Edit zone')}: ${tr(modal.zone.name, lang)}` : t('Tambah zona ongkir', 'Add shipping zone')} onClose={() => setModal(null)} width={860}>
          <form className="admin-form" onSubmit={(e) => void submitZone(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput label={t('Nama zona', 'Zone name')} value={zoneForm.name} onChange={(v) => setZoneForm({ ...zoneForm, name: v })} required errorId={firstError(formErrors, 'name.id', 'name')} errorEn={firstError(formErrors, 'name.en')} />
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Prioritas', 'Priority')}</span>
                <input type="number" min={-1000} max={1000} value={zoneForm.priority} onChange={(e) => setZoneForm({ ...zoneForm, priority: e.target.value })} />
                <small className="admin-field-hint">{t('Angka lebih besar menang bila cakupan sama spesifik.', 'Higher number wins when coverage is equally specific.')}</small>
                {firstError(formErrors, 'priority') && <small className="cms-field-error">{firstError(formErrors, 'priority')}</small>}
              </label>
              <label className="cms-check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" checked={zoneForm.isActive} onChange={(e) => setZoneForm({ ...zoneForm, isActive: e.target.checked })} />
                <span>{t('Aktif', 'Active')}</span>
              </label>
              <label className="cms-check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" checked={zoneForm.isDefault} onChange={(e) => setZoneForm({ ...zoneForm, isDefault: e.target.checked })} />
                <span>{t('Zona cadangan (alamat di luar semua zona)', 'Fallback zone (addresses outside all zones)')}</span>
              </label>
            </div>
            <RegionPicker value={zoneForm.regions} onChange={(regions) => setZoneForm({ ...zoneForm, regions })} error={firstError(formErrors, 'regions')} />
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : modal.zone ? t('Simpan perubahan', 'Save changes') : t('Tambah zona', 'Add zone')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'rate' && (
        <AdminModal title={modal.rate ? `${t('Edit tarif', 'Edit rate')}: ${tr(modal.rate.name, lang)}` : `${t('Tambah tarif', 'Add rate')} · ${tr(modal.zone.name, lang)}`} onClose={() => setModal(null)}>
          <form className="admin-form" onSubmit={(e) => void submitRate(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput label={t('Nama layanan', 'Service name')} value={rateForm.name} onChange={(v) => setRateForm({ ...rateForm, name: v })} required placeholder={t('Reguler / Ekspres / Kargo', 'Regular / Express / Cargo')} errorId={firstError(formErrors, 'name.id', 'name')} errorEn={firstError(formErrors, 'name.en')} />
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Jenis tarif', 'Rate type')}</span>
                <select value={rateForm.type} onChange={(e) => setRateForm({ ...rateForm, type: e.target.value as ShippingRateType })}>
                  {(Object.keys(shippingRateTypeLabels) as ShippingRateType[]).map((key) => (
                    <option key={key} value={key}>
                      {shippingRateTypeLabels[key][lang]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">{rateForm.type === 'flat' ? t('Tarif tetap (Rp)', 'Flat rate (Rp)') : t('Tarif dasar (Rp)', 'Base amount (Rp)')}</span>
                <input type="number" min={0} step={1} value={rateForm.baseAmount} onChange={(e) => setRateForm({ ...rateForm, baseAmount: e.target.value })} required />
                {firstError(formErrors, 'baseAmount') && <small className="cms-field-error">{firstError(formErrors, 'baseAmount')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Ongkir minimum (Rp)', 'Minimum charge (Rp)')}</span>
                <input type="number" min={0} step={1} value={rateForm.minAmount} onChange={(e) => setRateForm({ ...rateForm, minAmount: e.target.value })} />
                <small className="admin-field-hint">{t('Hasil hitung di bawah ini dinaikkan ke minimum.', 'Calculated amounts below this are raised to the minimum.')}</small>
              </label>
            </div>
            {rateForm.type === 'calculated' && (
              <fieldset className="ship-params">
                <legend>{t('Tiga parameter tarif', 'Three rate parameters')}</legend>
                <div className="admin-form-row admin-form-row-3">
                  <label>
                    <span className="field-label">{t('Per km jarak (Rp)', 'Per km of distance (Rp)')}</span>
                    <input type="number" min={0} step={1} value={rateForm.perKmAmount} onChange={(e) => setRateForm({ ...rateForm, perKmAmount: e.target.value })} />
                    <small className="admin-field-hint">{t('Dari titik asal ke titik peta alamat, dibulatkan ke atas per km. 0 = jarak tidak dihitung.', 'From the origin to the address pin, rounded up per km. 0 = distance ignored.')}</small>
                    {firstError(formErrors, 'perKmAmount') && <small className="cms-field-error">{firstError(formErrors, 'perKmAmount')}</small>}
                  </label>
                  <label>
                    <span className="field-label">{t('Per kg berat (Rp)', 'Per kg of weight (Rp)')}</span>
                    <input type="number" min={0} step={1} value={rateForm.perKgAmount} onChange={(e) => setRateForm({ ...rateForm, perKgAmount: e.target.value })} />
                    <small className="admin-field-hint">{t('Berat produk × qty, dibulatkan ke atas per kg.', 'Product weight × qty, rounded up per kg.')}</small>
                    {firstError(formErrors, 'perKgAmount') && <small className="cms-field-error">{firstError(formErrors, 'perKgAmount')}</small>}
                  </label>
                  <label>
                    <span className="field-label">{t('Per m³ volume (Rp)', 'Per m³ of volume (Rp)')}</span>
                    <input type="number" min={0} step={1} value={rateForm.perM3Amount} onChange={(e) => setRateForm({ ...rateForm, perM3Amount: e.target.value })} />
                    <small className="admin-field-hint">{t('Dimensi kemasan produk × qty, dibulatkan ke atas per 0,01 m³.', 'Product package size × qty, rounded up per 0.01 m³.')}</small>
                    {firstError(formErrors, 'perM3Amount') && <small className="cms-field-error">{firstError(formErrors, 'perM3Amount')}</small>}
                  </label>
                </div>
                <div className="ship-preview">
                  <span className="field-label">{t('Simulasi', 'Simulation')}</span>
                  <div className="ship-preview-inputs">
                    <label>
                      <input type="number" min={0} value={preview.km} onChange={(e) => setPreview({ ...preview, km: e.target.value })} /> km
                    </label>
                    <label>
                      <input type="number" min={0} value={preview.kg} onChange={(e) => setPreview({ ...preview, kg: e.target.value })} /> kg
                    </label>
                    <label>
                      <input type="number" min={0} step={0.01} value={preview.m3} onChange={(e) => setPreview({ ...preview, m3: e.target.value })} /> m³
                    </label>
                  </div>
                  <p className="ship-preview-result">
                    {formatIDR(previewResult.base)} + {formatIDR(previewResult.distance)} + {formatIDR(previewResult.weight)} + {formatIDR(previewResult.volume)} ={' '}
                    <strong>{formatIDR(previewResult.total)}</strong>
                    {previewResult.minimumApplied && <small> ({t('naik ke minimum', 'raised to minimum')})</small>}
                  </p>
                </div>
              </fieldset>
            )}
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Gratis ongkir di atas subtotal (Rp)', 'Free shipping above subtotal (Rp)')}</span>
                <input type="number" min={0} step={1} value={rateForm.freeAbove} onChange={(e) => setRateForm({ ...rateForm, freeAbove: e.target.value })} placeholder={t('kosong = tidak ada', 'empty = none')} />
                {firstError(formErrors, 'freeAbove') && <small className="cms-field-error">{firstError(formErrors, 'freeAbove')}</small>}
              </label>
            </div>
            <I18nInput label={t('Estimasi sampai', 'Delivery estimate')} value={rateForm.eta} onChange={(v) => setRateForm({ ...rateForm, eta: v })} placeholder="2–4 hari" errorId={firstError(formErrors, 'eta.id', 'eta')} errorEn={firstError(formErrors, 'eta.en')} />
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Urutan tampil', 'Display order')}</span>
                <input type="number" min={0} value={rateForm.sortOrder} onChange={(e) => setRateForm({ ...rateForm, sortOrder: e.target.value })} />
              </label>
              <label className="cms-check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={rateForm.isActive} onChange={(e) => setRateForm({ ...rateForm, isActive: e.target.checked })} />
                <span>{t('Aktif (ditawarkan saat checkout)', 'Active (offered at checkout)')}</span>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : modal.rate ? t('Simpan perubahan', 'Save changes') : t('Tambah tarif', 'Add rate')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
