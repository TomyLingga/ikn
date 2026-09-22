'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import { api, errorMessage } from '@/lib/api';
import type { CustomerAddress, CustomerProfile } from '@/lib/types';

interface AddressFields {
  label: string;
  recipient: string;
  phone: string;
  line: string;
}

function readFields(form: HTMLFormElement): AddressFields {
  const data = new FormData(form);
  return {
    label: String(data.get('label') || 'Alamat'),
    recipient: String(data.get('recipient') || ''),
    phone: String(data.get('phone') || ''),
    line: String(data.get('line') || ''),
  };
}

export default function CustomerAddresses() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<CustomerProfile>('/customer/profile')
      .then((data) => {
        if (active) setAddresses(data.addresses);
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err, 'Gagal memuat alamat.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const profile = await api<CustomerProfile>('/customer/addresses', {
        method: 'POST',
        body: readFields(form),
      });
      setAddresses(profile.addresses);
      form.reset();
      setShowForm(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function updateAddress(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await api<CustomerProfile>(`/customer/addresses/${id}`, {
        method: 'PUT',
        body: readFields(event.currentTarget),
      });
      setAddresses(profile.addresses);
      setEditingId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(id: string) {
    setBusy(true);
    setError(null);
    try {
      const profile = await api<CustomerProfile>(`/customer/addresses/${id}/primary`, {
        method: 'PUT',
      });
      setAddresses(profile.addresses);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: string) {
    if (!window.confirm('Hapus alamat ini?')) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await api<CustomerProfile>(`/customer/addresses/${id}`, {
        method: 'DELETE',
      });
      setAddresses(profile.addresses);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="form-note">Memuat…</p>;
  if (loadError) return <p className="form-error" role="alert">{loadError}</p>;

  return (
    <div>
      <div className="acct-section-head">
        <div><h2 className="h3">Alamat pengiriman</h2><p className="form-note">Pilih alamat utama yang digunakan saat checkout.</p></div>
        <button type="button" className="btn btn-line btn-sm" onClick={() => { setShowForm((value) => !value); setEditingId(null); }}><Icon name={showForm ? 'close' : 'plus'} size={17} /> {showForm ? 'Batal' : 'Tambah alamat'}</button>
      </div>

      {error && <p className="form-error" role="alert" style={{ marginBottom: 14 }}>{error}</p>}

      {showForm && (
        <form className="form acct-form address-form" onSubmit={addAddress}>
          <div className="co-fields">
            <label><span className="label">Label alamat</span><input name="label" placeholder="Gudang / Kantor" required /></label>
            <label><span className="label">Nama penerima</span><input name="recipient" required /></label>
            <label className="co-full"><span className="label">Telepon</span><input name="phone" required /></label>
            <label className="co-full"><span className="label">Alamat lengkap</span><textarea name="line" rows={3} required /></label>
          </div>
          <button type="submit" className="btn btn-solid" disabled={busy}>{busy ? 'Menyimpan…' : <>Simpan alamat <Icon name="arrow" /></>}</button>
        </form>
      )}

      <div className="address-grid">
        {addresses.map((address) => (
          <article key={address.id} className={`address-card ${address.primary ? 'is-primary' : ''}`}>
            {editingId === address.id ? (
              <form className="form acct-form address-form" onSubmit={(event) => updateAddress(event, address.id)}>
                <div className="co-fields">
                  <label><span className="label">Label alamat</span><input name="label" defaultValue={address.label} required /></label>
                  <label><span className="label">Nama penerima</span><input name="recipient" defaultValue={address.recipient} required /></label>
                  <label className="co-full"><span className="label">Telepon</span><input name="phone" defaultValue={address.phone} required /></label>
                  <label className="co-full"><span className="label">Alamat lengkap</span><textarea name="line" rows={3} defaultValue={address.line} required /></label>
                </div>
                <div className="address-actions">
                  <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
                  <button type="button" className="link" onClick={() => setEditingId(null)}>Batal</button>
                </div>
              </form>
            ) : (
              <>
                <div className="address-card-head"><h3>{address.label}</h3>{address.primary && <span className="badge badge-ok badge-sm">Utama</span>}</div>
                <p><strong>{address.recipient}</strong><br />{address.phone}<br />{address.line}</p>
                <div className="address-actions">
                  {!address.primary && <button type="button" className="link" onClick={() => setPrimary(address.id)} disabled={busy}>Jadikan utama</button>}
                  <button type="button" className="link" onClick={() => { setEditingId(address.id); setShowForm(false); }} disabled={busy}>Ubah</button>
                  <button type="button" className="link address-remove" onClick={() => removeAddress(address.id)} disabled={busy}>Hapus</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      {addresses.length === 0 && <p className="form-note">Belum ada alamat. Tambahkan alamat untuk mempermudah checkout.</p>}
    </div>
  );
}
