'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { queryString, type CustomerOption } from '@/lib/admin';

interface CustomerPickerProps {
  value: CustomerOption[];
  onChange: (value: CustomerOption[]) => void;
  error?: string;
}

// Pemilih customer sasaran (voucher/biaya tambahan): cari di GET /admin/customer-options (customer aktif, maks. 20
// hasil per pencarian), klik untuk menambah, tombol silang pada chip untuk menghapus.
export default function CustomerPicker({ value, onChange, error }: CustomerPickerProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Cari dengan jeda 250 ms; hasil basi diabaikan.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api<CustomerOption[]>(`/admin/customer-options${queryString({ q: query.trim() })}`)
        .then((rows) => {
          if (cancelled) return;
          setOptions(rows);
          setLoadError('');
        })
        .catch((err) => {
          if (!cancelled) setLoadError(errorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  // Klik di luar menutup daftar hasil.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selectedIds = new Set(value.map((c) => c.id));
  const available = options.filter((c) => !selectedIds.has(c.id));

  return (
    <div className="customer-picker" ref={boxRef}>
      {value.length > 0 && (
        <ul className="customer-picker-chips">
          {value.map((c) => (
            <li key={c.id}>
              <span>
                <strong>{c.company || c.name}</strong>
                <small>{c.company ? `${c.name} · ${c.email}` : c.email}</small>
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== c.id))}
                aria-label={`${t('Hapus', 'Remove')} ${c.company || c.name}`}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="customer-picker-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // Enter di kotak cari tidak boleh mengirim formulir induk.
            if (e.key === 'Enter') e.preventDefault();
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={t('Cari nama, perusahaan, atau email customer', 'Search customer name, company, or email')}
          aria-label={t('Cari customer', 'Search customers')}
        />
        {open && (
          <div className="customer-picker-results" role="listbox">
            {loadError && <p className="cms-field-error">{loadError}</p>}
            {!loadError && loading && available.length === 0 && <p className="admin-field-hint">{t('Mencari...', 'Searching...')}</p>}
            {!loadError && !loading && available.length === 0 && (
              <p className="admin-field-hint">
                {options.length > 0 ? t('Semua hasil sudah dipilih.', 'All results are already selected.') : t('Tidak ada customer aktif yang cocok.', 'No matching active customer.')}
              </p>
            )}
            {available.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={false}
                className="customer-picker-option"
                onClick={() => onChange([...value, c])}
              >
                <strong>{c.company || c.name}</strong>
                <small>{c.company ? `${c.name} · ${c.email}` : c.email}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <small className="admin-field-hint">
        {value.length} {t('customer dipilih. Hanya customer aktif yang bisa dicari.', 'customers selected. Only active customers are searchable.')}
      </small>
      {error && <small className="cms-field-error">{error}</small>}
    </div>
  );
}
