'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import AddressForm from '@/components/customer/AddressForm';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import type { CustomerAddress } from '@/lib/types';

/** Baris alamat siap tampil (tanpa nilai kosong). */
export function formatAddressLines(a: CustomerAddress): string[] {
  const region = [a.region?.village, a.region?.district, a.region?.regency, a.region?.province].filter(Boolean).join(', ');
  return [a.addressLine, [region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean);
}

export default function CustomerAddresses() {
  const { customer } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setAddresses(await api<CustomerAddress[]>('/customer/addresses'));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, t('Gagal memuat alamat.', 'Failed to load addresses.')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const setPrimary = (id: number) => mutate(() => api(`/customer/addresses/${id}/primary`, { method: 'PUT' }));
  const removeAddress = (id: number) => {
    if (!window.confirm(t('Hapus alamat ini?', 'Delete this address?'))) return;
    void mutate(() => api(`/customer/addresses/${id}`, { method: 'DELETE' }));
  };

  if (loading) return <p className="form-note">{t('Memuat…', 'Loading…')}</p>;
  if (loadError) return <p className="form-error" role="alert">{loadError}</p>;

  return (
    <div>
      <div className="acct-section-head">
        <div>
          <h2 className="h3">{t('Alamat pengiriman', 'Shipping addresses')}</h2>
          <p className="form-note">{t('Alamat utama dipakai otomatis saat checkout; ongkir dihitung per alamat.', 'The default address is preselected at checkout; shipping is calculated per address.')}</p>
        </div>
        <button type="button" className="btn btn-line btn-sm" onClick={() => { setShowForm((v) => !v); setEditingId(null); }}>
          <Icon name={showForm ? 'close' : 'plus'} size={17} /> {showForm ? t('Batal', 'Cancel') : t('Tambah alamat', 'Add address')}
        </button>
      </div>

      {error && <p className="form-error" role="alert" style={{ marginBottom: 14 }}>{error}</p>}

      {showForm && (
        <AddressForm
          defaults={{ recipientName: customer?.name, phone: customer?.profile?.phone || '' }}
          onSaved={() => { setShowForm(false); void reload(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="address-grid">
        {addresses.map((address) => (
          <article key={address.id} className={`address-card ${address.isDefault ? 'is-primary' : ''}`}>
            {editingId === address.id ? (
              <AddressForm initial={address} onSaved={() => { setEditingId(null); void reload(); }} onCancel={() => setEditingId(null)} />
            ) : (
              <>
                <div className="address-card-head">
                  <h3>{address.label}</h3>
                  {address.isDefault && <span className="badge badge-ok badge-sm">{t('Utama', 'Default')}</span>}
                </div>
                <p>
                  <strong>{address.recipientName}</strong><br />
                  {address.phone}<br />
                  {formatAddressLines(address).map((line) => (
                    <span key={line}>{line}<br /></span>
                  ))}
                  {address.note && <em>{address.note}</em>}
                </p>
                {address.lat != null && address.lng != null && (
                  <a
                    className="link address-map-link"
                    href={`https://www.openstreetmap.org/?mlat=${address.lat}&mlon=${address.lng}#map=17/${address.lat}/${address.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="pin" size={14} /> {t('Lihat di peta', 'View on map')}
                  </a>
                )}
                <div className="address-actions">
                  {!address.isDefault && <button type="button" className="link" onClick={() => setPrimary(address.id)} disabled={busy}>{t('Jadikan utama', 'Set as default')}</button>}
                  <button type="button" className="link" onClick={() => { setEditingId(address.id); setShowForm(false); }} disabled={busy}>{t('Ubah', 'Edit')}</button>
                  <button type="button" className="link address-remove" onClick={() => removeAddress(address.id)} disabled={busy}>{t('Hapus', 'Delete')}</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      {addresses.length === 0 && !showForm && (
        <p className="form-note">{t('Belum ada alamat. Tambahkan alamat untuk mempermudah checkout.', 'No addresses yet. Add one to speed up checkout.')}</p>
      )}
    </div>
  );
}
