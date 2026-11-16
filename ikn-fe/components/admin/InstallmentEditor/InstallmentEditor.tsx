'use client';

import Select from '@/components/Select';
import NumberInput from '@/components/NumberInput';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { emptyI18n, type I18n } from '@/lib/cms';
import { formatPercent, installmentTriggerLabels } from '@/lib/commerce';
import type { PaymentTermPayload } from '@/lib/admin';
import type { InstallmentScheduleRow, InstallmentTrigger } from '@/lib/types';

/** Satu baris jadwal termin di form (angka sebagai teks seperti field form lain). */
export interface InstallmentFormRow {
  key: string;
  label: I18n;
  percent: string;
  trigger: InstallmentTrigger;
  dueDays: string;
}

export const MAX_INSTALLMENT_ROWS = 6;

export function installmentRowsFromSchedule(rows?: InstallmentScheduleRow[] | null): InstallmentFormRow[] {
  return (rows || []).map((row) => ({
    key: row.key,
    label: { id: row.label?.id ?? '', en: row.label?.en ?? '' },
    percent: String(row.percent),
    trigger: row.trigger,
    dueDays: String(row.dueDays ?? 0),
  }));
}

/** Body `installments` untuk POST/PUT /admin/payment-terms; [] = satu pembayaran penuh. */
export function installmentPayload(rows: InstallmentFormRow[]): NonNullable<PaymentTermPayload['installments']> {
  return rows.map((row, index) => ({
    ...(row.key ? { key: row.key } : {}),
    label: { id: row.label.id.trim(), en: row.label.en.trim() },
    percent: Number(row.percent) || 0,
    trigger: index === 0 ? 'order' : row.trigger,
    dueDays: index === 0 ? 0 : Number(row.dueDays) || 0,
  }));
}

/** Jumlah persen dalam ratusan (3000 = 30%) agar 33,33 + 33,33 + 33,34 tepat 10000. */
export function installmentTotal(rows: InstallmentFormRow[]): number {
  return rows.reduce((sum, row) => sum + Math.round((Number(row.percent) || 0) * 100), 0);
}

/** Jadwal sah untuk disimpan: kosong (bayar penuh), atau setiap baris berpersen > 0 dan jumlahnya tepat 100%. */
export function installmentScheduleValid(rows: InstallmentFormRow[]): boolean {
  if (rows.length === 0) return true;
  return rows.every((row) => Number(row.percent) > 0 && row.label.id.trim() !== '') && installmentTotal(rows) === 10000;
}

interface Props {
  rows: InstallmentFormRow[];
  onChange: (rows: InstallmentFormRow[]) => void;
  errors?: FieldErrors;
  /** Jadwal hanya untuk syarat pasar ekspor; pasar lain menonaktifkan penambahan baris. */
  disabled?: boolean;
}

/**
 * Editor jadwal termin di form syarat pembayaran (ASUMSI A-97): baris nama ID/EN, persen, kapan ditagih, dan hari
 * jatuh tempo, dengan pemeriksaan langsung bahwa jumlah persen tepat 100. Baris pertama selalu ditagih saat pesanan
 * dibuat dan memakai batas bayar pesanan.
 */
export default function InstallmentEditor({ rows, onChange, errors = {}, disabled = false }: Props) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const total = installmentTotal(rows);
  const totalOk = total === 10000;
  const update = (index: number, patch: Partial<InstallmentFormRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  function add() {
    if (rows.length >= MAX_INSTALLMENT_ROWS) return;
    // Baris baru mengambil sisa persen agar total langsung 100.
    const rest = Math.max(0, 10000 - total) / 100;
    if (rows.length === 0) {
      onChange([
        { key: '', label: emptyI18n(), percent: '30', trigger: 'order', dueDays: '0' },
        { key: '', label: emptyI18n(), percent: '70', trigger: 'shipped', dueDays: '14' },
      ]);
      return;
    }
    onChange([...rows, { key: '', label: emptyI18n(), percent: rest > 0 ? String(rest) : '', trigger: 'shipped', dueDays: '14' }]);
  }

  return (
    <div className="adm-termin">
      <span className="field-label">{t('Jadwal termin', 'Payment schedule')}</span>
      <small className="admin-field-hint">
        {t(
          'Kosong = satu pembayaran penuh saat pesanan dibuat. Isi bila pembayaran bertahap, mis. uang muka 30% lalu pelunasan 70% saat barang dikirim. Perubahan hanya berlaku untuk pesanan baru.',
          'Empty = one full payment when the order is placed. Fill it in for staged payments, e.g. a 30% down payment then the 70% balance when the goods ship. Changes only apply to new orders.',
        )}
      </small>
      {firstError(errors, 'installments') && <small className="cms-field-error">{firstError(errors, 'installments')}</small>}

      {rows.map((row, index) => {
        const first = index === 0;
        const base = `installments.${index}`;
        return (
          <div className="adm-termin-row" key={index}>
            <div className="adm-termin-head">
              <strong>
                {t('Termin', 'Installment')} {index + 1}
              </strong>
              <button type="button" className="btn btn-line btn-sm" onClick={() => remove(index)}>
                {t('Hapus termin', 'Remove installment')}
              </button>
            </div>
            <I18nInput
              label={t('Nama termin', 'Installment name')}
              value={row.label}
              onChange={(label) => update(index, { label })}
              required
              maxLength={80}
              placeholder={first ? t('Uang muka 30%', '30% down payment') : t('Pelunasan 70%', '70% balance')}
              errorId={firstError(errors, `${base}.label.id`, `${base}.label`)}
              errorEn={firstError(errors, `${base}.label.en`)}
            />
            <div className="adm-termin-grid">
              <label>
                <span className="field-label">{t('Persen', 'Percent')} *</span>
                <div className="admin-input-suffix">
                  <NumberInput min={0.01} max={100} step={0.01} value={row.percent} onChange={(e) => update(index, { percent: e.target.value })} required />
                  <span>%</span>
                </div>
                {firstError(errors, `${base}.percent`) && <small className="cms-field-error">{firstError(errors, `${base}.percent`)}</small>}
              </label>
              <label>
                <span className="field-label">{t('Ditagih', 'Billed')}</span>
                <Select value={first ? 'order' : row.trigger} disabled={first} onChange={(e) => update(index, { trigger: e.target.value as InstallmentTrigger })}>
                  {(Object.keys(installmentTriggerLabels) as InstallmentTrigger[])
                    .filter((key) => first || key !== 'order')
                    .map((key) => (
                      <option key={key} value={key}>
                        {installmentTriggerLabels[key][lang]}
                      </option>
                    ))}
                </Select>
                {firstError(errors, `${base}.trigger`) && <small className="cms-field-error">{firstError(errors, `${base}.trigger`)}</small>}
              </label>
              <label>
                <span className="field-label">{t('Jatuh tempo (hari)', 'Due (days)')}</span>
                {first ? (
                  <input value={t('Batas bayar pesanan', 'Order payment deadline')} disabled readOnly />
                ) : (
                  <NumberInput min={0} max={365} step={1} value={row.dueDays} onChange={(e) => update(index, { dueDays: e.target.value })} />
                )}
                {firstError(errors, `${base}.dueDays`) && <small className="cms-field-error">{firstError(errors, `${base}.dueDays`)}</small>}
              </label>
            </div>
          </div>
        );
      })}

      <div className="adm-termin-foot">
        <button type="button" className="btn btn-line btn-sm" onClick={add} disabled={disabled || rows.length >= MAX_INSTALLMENT_ROWS}>
          {rows.length === 0 ? t('Buat jadwal termin', 'Create a payment schedule') : t('Tambah termin', 'Add installment')}
        </button>
        {rows.length > 0 && (
          <span className={`adm-termin-total ${totalOk ? 'is-ok' : 'is-bad'}`} role="status">
            {t('Total', 'Total')} {formatPercent(total / 100, lang)}
            {totalOk ? '' : t(': harus tepat 100%', ': must be exactly 100%')}
          </span>
        )}
      </div>
      {disabled && rows.length === 0 && <small className="admin-field-hint">{t('Jadwal termin hanya untuk syarat pembayaran pasar ekspor.', 'Payment schedules are only for export market payment terms.')}</small>}
      {rows.length === 1 && <small className="admin-field-hint">{t('Satu termin 100% sama dengan bayar penuh dan disimpan tanpa jadwal.', 'A single 100% installment equals full payment and is saved without a schedule.')}</small>}
    </div>
  );
}
