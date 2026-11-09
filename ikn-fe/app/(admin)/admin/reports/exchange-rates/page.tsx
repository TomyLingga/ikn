'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import StatusBadge from '@/components/StatusBadge';
import CountUp from '@/components/CountUp';
import AdminModal from '@/components/admin/AdminModal';
import ExchangeRateChart, { RateDelta, rateChange, formatPct, type ChartGranularity, type RateChange } from '@/components/admin/ExchangeRateChart';
import { AdminCard, AdminPageHead, DataTable, type Column } from '@/components/admin/AdminPage';
import { firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { exchangeRateSourceLabels, isoDate, type ExchangeRatePoint, type ExchangeRateSummary } from '@/lib/admin';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';

// Rentang grafik (segmented control). Disimpan di URL (?range=3m) agar bisa dibagikan, dan di localStorage sebagai
// pilihan terakhir admin bila URL tidak membawa range.
const RANGES = [
  { key: '1m', months: 1, short: { id: '1B', en: '1M' }, long: { id: '1 bulan', en: '1 month' } },
  { key: '3m', months: 3, short: { id: '3B', en: '3M' }, long: { id: '3 bulan', en: '3 months' } },
  { key: '6m', months: 6, short: { id: '6B', en: '6M' }, long: { id: '6 bulan', en: '6 months' } },
  { key: '1y', months: 12, short: { id: '1T', en: '1Y' }, long: { id: '1 tahun', en: '1 year' } },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];
const DEFAULT_RANGE: RangeKey = '3m';
const RANGE_STORAGE_KEY = 'ikn-admin-xr-range';

function isRangeKey(value: string | null | undefined): value is RangeKey {
  return RANGES.some((r) => r.key === value);
}

function rangePeriod(months: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - months);
  return { from: isoDate(from), to: isoDate(to) };
}

/** Rupiah bertanda untuk perubahan: +Rp 25 / −Rp 25. */
function signedIDR(n: number): string {
  const v = Math.round(n);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatIDR(Math.abs(v))}`;
}

// Kurs JISDOR USD/IDR (kontrak 11.7, ASUMSI A-84): GET /admin/exchange-rates?from&to + POST kurs manual yang menimpa
// tanggal yang sama. Informasi untuk tim keuangan; tidak menyentuh order/invoice. Perubahan harian/periode dan
// tanggal tertinggi/terendah dihitung di klien dari series.
export default function AdminExchangeRates() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [range, setRange] = useState<RangeKey | null>(null);
  const [data, setData] = useState<ExchangeRateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ date: '', rate: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const requestId = useRef(0);

  // Rentang awal: ?range= di URL, lalu pilihan terakhir di localStorage, lalu bawaan 3 bulan.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('range');
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(RANGE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    setRange(isRangeKey(fromUrl) ? fromUrl : isRangeKey(stored) ? stored : DEFAULT_RANGE);
  }, []);

  const activeRange = RANGES.find((r) => r.key === (range ?? DEFAULT_RANGE)) ?? RANGES[1];

  // Data lama tetap tampil (redup) selama rentang baru dimuat; respons yang terlambat diabaikan.
  const load = useCallback(async (months: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const { from, to } = rangePeriod(months);
      const result = await api<ExchangeRateSummary>(`/admin/exchange-rates?from=${from}&to=${to}`);
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (range) void load(activeRange.months);
  }, [range, activeRange.months, load]);

  function selectRange(key: RangeKey) {
    if (key === range) return;
    setRange(key);
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, key);
    } catch {
      // localStorage tidak tersedia (mode privat): pilihan tetap tersimpan di URL.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('range', key);
    window.history.replaceState(window.history.state, '', url.toString());
  }

  function openForm() {
    setForm({ date: isoDate(new Date()), rate: '' });
    setFormError('');
    setFormErrors({});
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      await api('/admin/exchange-rates', { method: 'POST', body: { date: form.date, rate: Number(form.rate) } });
      setFormOpen(false);
      await load(activeRange.months);
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

  const rangeLong = activeRange.long[lang];
  const granularity: ChartGranularity = activeRange.months <= 1 ? 'day' : 'month';
  const series = useMemo(() => data?.series ?? [], [data]);

  // Ringkasan klien: perubahan per titik (vs hari kerja sebelumnya), tanggal tertinggi/terendah, perubahan periode.
  const derived = useMemo(() => {
    const changes = new Map<string, RateChange | null>();
    series.forEach((p, i) => changes.set(p.date, rateChange(series[i - 1]?.rate, p.rate)));
    const first = series[0];
    const last = series[series.length - 1];
    let maxP = first;
    let minP = first;
    for (const p of series) {
      if (maxP && p.rate > maxP.rate) maxP = p;
      if (minP && p.rate <= minP.rate) minP = p;
    }
    return { changes, first, last, maxP, minP, period: series.length > 1 ? rateChange(first?.rate, last?.rate) : null };
  }, [series]);

  const latest = data?.latest ?? null;
  const latestIdx = latest ? series.findIndex((p) => p.date === latest.date) : -1;
  const latestChange = latest && latestIdx > 0 ? rateChange(series[latestIdx - 1]?.rate, latest.rate) : null;
  const rows = [...series].reverse();
  const columns: Column<ExchangeRatePoint>[] = [
    { key: 'date', label: t('Tanggal', 'Date'), sortValue: (r) => r.date, render: (r) => formatDate(r.date, lang) },
    { key: 'rate', label: t('Kurs', 'Rate'), align: 'right', sortValue: (r) => r.rate, render: (r) => <strong className="mono">{formatIDR(r.rate)}</strong> },
    {
      key: 'change',
      label: t('Perubahan', 'Change'),
      align: 'right',
      sortValue: (r) => derived.changes.get(r.date)?.delta ?? 0,
      render: (r) => <RateDelta change={derived.changes.get(r.date) ?? null} />,
    },
    {
      key: 'source',
      label: t('Sumber', 'Source'),
      render: (r) => <StatusBadge label={exchangeRateSourceLabels[r.source][lang]} tone={exchangeRateSourceLabels[r.source].tone} small />,
    },
  ];

  const stat = (key: string, label: string, value: number | null | undefined, index: number, sub?: ReactNode, format: (n: number) => string = formatIDR) => (
    <div className={`admin-stat xr-stat xr-stat-${key}`} style={{ '--i': index } as CSSProperties}>
      <span className="xr-stat-label">{label}</span>
      <strong>{value != null ? <CountUp value={value} format={format} delay={index * 70} /> : '—'}</strong>
      {sub && <div className="xr-stat-sub">{sub}</div>}
    </div>
  );

  const periodText =
    derived.first && derived.last
      ? `${formatDate(derived.first.date, lang)} – ${formatDate(derived.last.date, lang)} · ${t(`${series.length} hari kerja`, `${series.length} working days`)}`
      : '';

  return (
    <div>
      <AdminPageHead
        title={t('Kurs JISDOR USD/IDR', 'JISDOR Rate USD/IDR')}
        desc={t(
          'Kurs referensi Bank Indonesia (JISDOR) sebagai informasi bagi tim keuangan; hanya terbit pada hari kerja. Tidak dipakai dalam perhitungan order maupun invoice.',
          'Bank Indonesia reference rate (JISDOR) as information for the finance team; published on working days only. Not used in order or invoice calculations.',
        )}
        action={{ label: t('Tambah kurs manual', 'Add manual rate'), icon: 'plus', onClick: openForm }}
      />

      <div className="xr-toolbar">
        <div className="xr-range" role="group" aria-label={t('Rentang waktu', 'Time range')}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={r.key === activeRange.key ? 'is-active' : ''}
              aria-pressed={r.key === activeRange.key}
              title={r.long[lang]}
              onClick={() => selectRange(r.key)}
            >
              <span aria-hidden="true">{r.short[lang]}</span>
              <span className="sr-only">{r.long[lang]}</span>
            </button>
          ))}
        </div>
        <span className="xr-period">{loading && data ? <Spinner label={t('Memperbarui...', 'Updating...')} /> : periodText}</span>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && !data && <Spinner block label={t('Memuat kurs...', 'Loading rates...')} />}

      {data && (
        <div className={`xr-body${loading ? ' is-loading' : ''}`} aria-busy={loading}>
          {data.stale && (
            <div className="xr-stale" role="status">
              <Icon name="clock" size={18} />
              <span>
                {t(
                  `Data belum diperbarui ${data.staleDays} hari kerja. Minta tim TI memeriksa pengambilan kurs otomatis, atau isi kurs manual.`,
                  `Data has not been updated for ${data.staleDays} working days. Ask the IT team to check the automatic rate download, or add a manual rate.`,
                )}
              </span>
            </div>
          )}

          <div className="admin-stat-grid xr-stats">
            {stat(
              'latest',
              t('Kurs terakhir', 'Latest rate'),
              latest?.rate,
              0,
              latest ? (
                <>
                  <span className="xr-stat-change">
                    <RateDelta change={latestChange} />
                    {latestChange && <em>{t('vs hari kerja sebelumnya', 'vs previous working day')}</em>}
                  </span>
                  <span className="xr-stat-meta">
                    {formatDate(latest.date, lang)}
                    <StatusBadge label={exchangeRateSourceLabels[latest.source][lang]} tone={exchangeRateSourceLabels[latest.source].tone} small />
                  </span>
                </>
              ) : (
                t('Belum ada data', 'No data yet')
              ),
            )}
            {stat(
              'period',
              t(`Perubahan ${rangeLong}`, `${rangeLong} change`),
              derived.period?.delta,
              1,
              derived.period && derived.first ? (
                <span className="xr-stat-change">
                  <RateDelta change={derived.period} />
                  <em>
                    {t('sejak', 'since')} {formatDate(derived.first.date, lang)}
                  </em>
                </span>
              ) : undefined,
              signedIDR,
            )}
            {stat(
              'avg',
              t(`Rata-rata ${rangeLong}`, `${rangeLong} average`),
              data.average,
              2,
              series.length ? t(`${series.length} hari kerja`, `${series.length} working days`) : undefined,
            )}
            {stat('max', t('Tertinggi', 'Highest'), derived.maxP?.rate ?? data.max, 3, derived.maxP ? formatDate(derived.maxP.date, lang) : undefined)}
            {stat('min', t('Terendah', 'Lowest'), derived.minP?.rate ?? data.min, 4, derived.minP ? formatDate(derived.minP.date, lang) : undefined)}
          </div>

          <div style={{ marginBottom: 22 }}>
            <AdminCard
              className="xr-card"
              title={t(`Grafik ${rangeLong} terakhir`, `Last ${rangeLong}`)}
              desc={
                data.fetchedAt
                  ? t(`Diambil dari Bank Indonesia terakhir ${formatDateTime(data.fetchedAt, lang)}.`, `Last fetched from Bank Indonesia ${formatDateTime(data.fetchedAt, lang)}.`)
                  : t('Belum pernah diambil dari Bank Indonesia.', 'Not fetched from Bank Indonesia yet.')
              }
            >
              <ExchangeRateChart data={series} average={data.average} granularity={granularity} />
            </AdminCard>
          </div>

          <AdminCard
            title={t('Kurs harian', 'Daily rates')}
            desc={t(
              'Terbaru di atas. Perubahan dibanding hari kerja sebelumnya. Kurs manual menimpa tanggal yang sama dan tertimpa lagi saat JISDOR tanggal itu terbit.',
              'Newest first. Change is against the previous working day. A manual rate replaces the same date and is replaced again when JISDOR publishes that date.',
            )}
          >
            <DataTable columns={columns} rows={rows} rowKey="date" loading={loading} empty={t('Belum ada data kurs.', 'No rate data yet.')} />
          </AdminCard>
        </div>
      )}

      {formOpen && (
        <AdminModal title={t('Tambah kurs manual', 'Add manual rate')} onClose={() => setFormOpen(false)} small>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <label>
              <span className="field-label">{t('Tanggal', 'Date')} *</span>
              <input type="date" max={isoDate(new Date())} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              {firstError(formErrors, 'date') && <small className="cms-field-error">{firstError(formErrors, 'date')}</small>}
            </label>
            <label>
              <span className="field-label">{t('Kurs (Rp per USD)', 'Rate (Rp per USD)')} *</span>
              <input
                type="number"
                min={1000}
                max={1000000}
                step={1}
                inputMode="numeric"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="16500"
                required
              />
              {firstError(formErrors, 'rate') && <small className="cms-field-error">{firstError(formErrors, 'rate')}</small>}
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : t('Simpan kurs', 'Save rate')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
