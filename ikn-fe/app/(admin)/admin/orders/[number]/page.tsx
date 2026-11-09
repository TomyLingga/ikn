'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import OrderTracking from '@/components/OrderTracking';
import EmptyState from '@/components/EmptyState';
import SessionLoader from '@/components/SessionLoader';
import AdminModal from '@/components/admin/AdminModal';
import AcceptPaymentModal from '@/components/admin/AcceptPaymentModal';
import { AdminCard } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import {
  DEFAULT_FREIGHT_LINE_LABELS,
  deliveryAddress,
  destinationPortText,
  freightLineLabel,
  freightQuoteLabel,
  isPickupOrder,
  isPortAddress,
  isPortOrder,
  isQuotedFreightOrder,
  orderLabel,
  orderVariant,
  paymentLabel,
  shipmentMetricsText,
  shippingBreakdownText,
  hasMultipleOrigins,
  joinNames,
  orderPickupPoints,
  pickupItemNames,
  pickupPointName,
  shippingOriginText,
} from '@/lib/commerce';
import { api, apiUpload, ApiError, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { adminCancellableStatuses, dueEditableStatuses, fromDateTimeLocal, isoDate, paymentMethodSummary, refreshAdminBadges, type CommerceSettingsData } from '@/lib/admin';
import { currencyStep, formatDate, formatDateTime, formatMoney, toMinorInput } from '@/lib/format';
import type { FreightQuote, Order, OrderAttachment, Payment, ProformaPayload, TrackingUpdate } from '@/lib/types';
import styles from './page.module.css';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';
import { FileLink } from '@/components/FileViewer';

type Modal =
  | { type: 'cancel' }
  | { type: 'ship' }
  | { type: 'due' }
  | { type: 'reject'; payment: Payment }
  | { type: 'accept'; payment: Payment }
  | { type: 'note'; status: 'processing' | 'delivered' | 'completed' }
  | { type: 'proforma' }
  | { type: 'freight' }
  | { type: 'freightExtend'; quote: FreightQuote }
  | null;

const EXTEND_OPTIONS = [6, 12, 24, 48, 72, 168];

/** Baris editor penawaran ongkir (nominal desimal mata uang order; dikonversi ke satuan terkecil saat kirim). */
type FreightLineForm = { label: string; amount: string };
const FREIGHT_LINE_SUGGESTIONS = [...DEFAULT_FREIGHT_LINE_LABELS, 'THC', 'Documentation', 'Handling'];
const FREIGHT_MAX_LINES = 10;
const DEFAULT_FREIGHT_VALID_DAYS = 7;

/** Keterangan lampiran yang sering dipakai (klik mengisi kolom keterangan): dokumen ekspor untuk order FOB/CIF, dokumen lokal untuk lainnya. */
const ATTACHMENT_CHIPS_EXPORT = ['Packing List', 'Bill of Lading', 'Certificate of Origin', 'COA', 'Delivery Order', 'SPPB', 'Faktur Pajak'];
const ATTACHMENT_CHIPS_LOCAL = ['Faktur Pajak', 'Surat Jalan', 'Delivery Order', 'SPPB', 'COA'];

/** Isian formulir proforma (string kosong = null saat dikirim; PUT mengganti seluruh isi, kontrak 11.11). */
type ProformaForm = Record<keyof ProformaPayload, string>;
const EMPTY_PROFORMA: ProformaForm = { vesselName: '', voyage: '', etd: '', eta: '', portOfLoading: '', portOfDischarge: '', paymentTerms: '', notes: '', validUntil: '' };
const PROFORMA_FIELDS = Object.keys(EMPTY_PROFORMA) as (keyof ProformaPayload)[];
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Pesan aksi: 409 INVALID_TRANSITION menyertakan meta.from/to; 422 pesan field pertama. */
function actionErrorText(err: unknown, lang: 'id' | 'en'): string {
  if (err instanceof ApiError && err.code === 'INVALID_TRANSITION' && err.meta) {
    const from = String(err.meta.from ?? '?');
    const to = String(err.meta.to ?? '?');
    return `${err.message} (${orderLabel(from)[lang]} → ${orderLabel(to)[lang]})`;
  }
  return errorMessage(err);
}

// Detail order admin: GET /admin/orders/{number}; aksi status/cancel/due + accept/reject payment aktif.
export default function AdminOrderDetail({ params }: { params: { number: string } }) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const number = decodeURIComponent(params.number);
  const orderPath = `/admin/orders/${encodeURIComponent(number)}`;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  // Field modal.
  const [reason, setReason] = useState('');
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');
  const [trackNote, setTrackNote] = useState('');
  // Lampiran (faktur pajak, surat jalan): dipilih di modal "Tandai dikirim" atau diunggah dari kartu Lampiran.
  const [shipFiles, setShipFiles] = useState<File[]>([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachLabel, setAttachLabel] = useState('');
  const [dueMode, setDueMode] = useState<'hours' | 'date'>('hours');
  const [extendHours, setExtendHours] = useState('24');
  const [dueAt, setDueAt] = useState('');
  // Order FOB/CIF (ASUMSI A-88): modal "Tandai dimuat ke kapal" (kapal + B/L menggantikan kurir/resi) dan proforma invoice.
  const [vesselName, setVesselName] = useState('');
  const [voyage, setVoyage] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [blDate, setBlDate] = useState('');
  const [pf, setPf] = useState<ProformaForm>(EMPTY_PROFORMA);
  const [pfErrors, setPfErrors] = useState<Partial<Record<keyof ProformaPayload, string>>>({});
  // Penawaran ongkir CIF (ASUMSI A-89): editor baris + masa berlaku + catatan; `freightValidDays` dari pengaturan commerce.
  const [fqLines, setFqLines] = useState<FreightLineForm[]>([]);
  const [fqValidUntil, setFqValidUntil] = useState('');
  const [fqNote, setFqNote] = useState('');
  const [fqErrors, setFqErrors] = useState<Record<string, string>>({});
  const [freightValidDays, setFreightValidDays] = useState<number | null>(null);
  // Order Loco (ASUMSI A-85): tanpa kurir/resi, label "Siap diambil"/"Sudah diambil", tanpa catatan perjalanan.
  const pickup = isPickupOrder(order);
  // Order FOB/CIF (ASUMSI A-86/A-88): serah terima di pelabuhan muat, snapshot alamat = identitas perusahaan pembeli, angka USD,
  // shipped = dimuat ke kapal. `variant` memilih teks status (Loco / port / diantar).
  const port = isPortOrder(order);
  const variant = orderVariant(order);
  // Kartu proforma hanya untuk order ekspor (term port atau mata uang USD); server sendiri mengizinkan order mana pun yang tidak batal.
  const showProforma = port || order?.currency === 'USD';
  // Order CIF (ASUMSI A-89): kartu penawaran ongkir; baris ongkir disepakati menggantikan satu baris Ongkir di ringkasan.
  const quoted = isQuotedFreightOrder(order);
  const activeQuote = order?.activeFreightQuote ?? null;
  const agreedLines = order?.shippingMethod?.lines ?? [];
  const awaitingFreight = order?.status === 'awaiting_freight';
  const formatIDR = (value: number | null | undefined) => formatMoney(value, order?.currency);
  const fqTotal = fqLines.reduce((sum, line) => sum + (toMinorInput(line.amount, order?.currency) ?? 0), 0);

  // Masa berlaku bawaan penawaran dari pengaturan commerce; admin tanpa modul settings memakai bawaan 7 hari.
  useEffect(() => {
    if (!awaitingFreight || freightValidDays !== null) return;
    let active = true;
    api<CommerceSettingsData>('/admin/settings')
      .then((settings) => {
        if (active) setFreightValidDays(settings.freightQuoteValidDays ?? DEFAULT_FREIGHT_VALID_DAYS);
      })
      .catch(() => {
        if (active) setFreightValidDays(DEFAULT_FREIGHT_VALID_DAYS);
      });
    return () => {
      active = false;
    };
  }, [awaitingFreight, freightValidDays]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      setOrder(await api<Order>(orderPath));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openModal(next: Modal) {
    setReason('');
    setCourier(order?.courier || '');
    setTrackingNumber(order?.trackingNumber || '');
    // Kapal/voyage diawali dari data kapal order atau dari proforma terakhir agar admin tidak mengetik ulang.
    setVesselName(order?.shipmentDetails?.vessel || order?.proforma?.vesselName || '');
    setVoyage(order?.shipmentDetails?.voyage || order?.proforma?.voyage || '');
    setBlNumber(order?.shipmentDetails?.blNumber || '');
    setBlDate(order?.shipmentDetails?.blDate || '');
    setNote('');
    setDueMode('hours');
    setExtendHours('24');
    setDueAt('');
    setActionError('');
    setModal(next);
  }

  // Proforma invoice (ASUMSI A-88): formulir diisi dari proforma terakhir; untuk proforma pertama, pelabuhan muat dan syarat
  // pembayaran diawali dari term dan snapshot order (sama dengan bawaan server untuk field kosong).
  function openProforma() {
    if (!order) return;
    const current = order.proforma;
    const snapshot = isPortAddress(order.shippingAddress) ? order.shippingAddress : null;
    setPf({
      vesselName: current?.vesselName || '',
      voyage: current?.voyage || '',
      etd: current?.etd || '',
      eta: current?.eta || '',
      portOfLoading: current?.portOfLoading || snapshot?.loadingPort || order.deliveryTerm?.loadingPort || '',
      portOfDischarge: current?.portOfDischarge || order.destinationPort?.name || '',
      paymentTerms: current?.paymentTerms || tr(order.paymentTerm?.description, 'en') || tr(order.paymentTerm?.name, 'en') || '',
      notes: current?.notes || '',
      validUntil: current?.validUntil || '',
    });
    setPfErrors({});
    openModal({ type: 'proforma' });
  }

  const setPfField = (key: keyof ProformaPayload) => (event: { target: { value: string } }) => {
    const value = event.target.value;
    setPf((prev) => ({ ...prev, [key]: value }));
    setPfErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  async function submitProforma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !order) return;
    // Semua field dikirim (kosong = null): PUT mengganti seluruh isi proforma, field yang tidak dikirim menjadi null.
    const body = PROFORMA_FIELDS.reduce((acc, key) => ({ ...acc, [key]: pf[key].trim() || null }), {} as ProformaPayload);
    const wasExisting = !!order.proforma;
    setBusy(true);
    setActionError('');
    setActionOk('');
    setPfErrors({});
    try {
      await api(`${orderPath}/proforma`, { method: 'PUT', body });
      await refresh();
      setModal(null);
      setActionOk(
        wasExisting
          ? t('Proforma disimpan sebagai revisi baru. Customer dikirimi email dan notifikasi.', 'Proforma saved as a new revision. The customer has been emailed and notified.')
          : t('Proforma invoice dibuat. Customer dikirimi email dan notifikasi.', 'Proforma invoice created. The customer has been emailed and notified.'),
      );
    } catch (err) {
      // 422: pesan per field di bawah isian; 409 PROFORMA_NOT_ALLOWED (order batal/kedaluwarsa) dan galat lain di atas tombol.
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        const next: Partial<Record<keyof ProformaPayload, string>> = {};
        for (const [key, messages] of Object.entries(err.errors)) {
          if (PROFORMA_FIELDS.includes(key as keyof ProformaPayload) && messages[0]) next[key as keyof ProformaPayload] = messages[0];
        }
        setPfErrors(next);
      }
      setActionError(actionErrorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<unknown>, okMessage: string) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      await action();
      refreshAdminBadges(); // terima/tolak pembayaran atau batal order mengubah antrean verifikasi di sidebar
      await refresh();
      setActionOk(okMessage);
      setModal(null);
    } catch (err) {
      setActionError(actionErrorText(err, lang));
      // 409 (status/penawaran sudah berubah di tempat lain): muat ulang order agar tombol dan angka sesuai keadaan terbaru.
      if (err instanceof ApiError && err.status === 409) {
        refreshAdminBadges();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- Penawaran ongkir CIF (ASUMSI A-89) ----
  const plusDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return isoDate(d);
  };

  function openFreightModal() {
    setFqLines(DEFAULT_FREIGHT_LINE_LABELS.map((label) => ({ label, amount: '' })));
    setFqValidUntil(plusDays(freightValidDays ?? DEFAULT_FREIGHT_VALID_DAYS));
    setFqNote('');
    setFqErrors({});
    openModal({ type: 'freight' });
  }

  function openExtendModal(quote: FreightQuote) {
    setFqValidUntil(plusDays(freightValidDays ?? DEFAULT_FREIGHT_VALID_DAYS));
    setFqErrors({});
    openModal({ type: 'freightExtend', quote });
  }

  const setFqLine = (index: number, patch: Partial<FreightLineForm>) => {
    setFqLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setFqErrors((prev) => {
      const next = { ...prev };
      delete next[`lines.${index}.label`];
      delete next[`lines.${index}.amount`];
      delete next.total;
      return next;
    });
  };

  async function submitFreight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !order) return;
    const lines = fqLines.map((line) => ({ label: line.label.trim(), amount: toMinorInput(line.amount, order.currency) }));
    const errors: Record<string, string> = {};
    lines.forEach((line, i) => {
      if (!line.label) errors[`lines.${i}.label`] = t('Keterangan wajib diisi.', 'Description is required.');
      if (line.amount == null || line.amount < 0) errors[`lines.${i}.amount`] = t('Isi nominal 0 atau lebih.', 'Enter an amount of 0 or more.');
    });
    if (lines.length === 0) errors.total = t('Isi minimal satu baris.', 'Add at least one line.');
    else if (fqTotal <= 0) errors.total = t('Total penawaran harus lebih dari 0.', 'The quote total must be above 0.');
    if (Object.keys(errors).length > 0) {
      setFqErrors(errors);
      return;
    }
    setBusy(true);
    setActionError('');
    setActionOk('');
    setFqErrors({});
    try {
      await api(`${orderPath}/freight-quotes`, {
        method: 'POST',
        body: { lines: lines.map((line) => ({ label: line.label, amount: line.amount as number })), validUntil: fqValidUntil || undefined, note: fqNote.trim() || undefined },
      });
      refreshAdminBadges();
      await refresh();
      setModal(null);
      setActionOk(t('Penawaran ongkir dikirim. Customer dikirimi email dan notifikasi.', 'Freight quote sent. The customer has been emailed and notified.'));
    } catch (err) {
      // 422: pesan per field (lines.N.label/amount, validUntil, note) di bawah isian; 409 FREIGHT_QUOTE_NOT_ALLOWED di atas tombol.
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        const next: Record<string, string> = {};
        for (const [key, messages] of Object.entries(err.errors)) if (messages[0]) next[key] = messages[0];
        setFqErrors(next);
      }
      setActionError(actionErrorText(err, lang));
      if (err instanceof ApiError && err.status === 409) {
        refreshAdminBadges();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function submitExtend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== 'freightExtend') return;
    if (!fqValidUntil) {
      setFqErrors({ validUntil: t('Tanggal wajib diisi.', 'Date is required.') });
      return;
    }
    void run(
      () => api(`${orderPath}/freight-quotes/${modal.quote.id}/extend`, { method: 'PUT', body: { validUntil: fqValidUntil } }),
      t('Masa berlaku penawaran diperpanjang. Customer sudah diberi tahu.', 'Quote validity extended. The customer has been notified.'),
    );
  }

  async function acceptCounter(quote: FreightQuote) {
    const ok = await confirmDialog(
      t(
        `Terima harga balasan customer ${formatIDR(quote.total)}? Total order dihitung ulang, pembayaran dan batas bayar dibuat, lalu order berstatus Menunggu pembayaran.`,
        `Accept the customer counter price of ${formatIDR(quote.total)}? The order total is recalculated, a payment and deadline are created, and the order moves to Awaiting payment.`,
      ),
    );
    if (!ok) return;
    void run(() => api(`${orderPath}/freight-quotes/${quote.id}/accept`, { method: 'POST' }), t('Harga balasan diterima. Order menunggu pembayaran.', 'Counter price accepted. The order is awaiting payment.'));
  }

  function changeStatus(status: 'processing' | 'shipped' | 'delivered' | 'completed', extra: Record<string, string | null> = {}) {
    void run(
      () => api(`${orderPath}/status`, { method: 'POST', body: { status, ...extra } }),
      t(`Status order diubah menjadi ${orderLabel(status, variant).id}.`, `Order status changed to ${orderLabel(status, variant).en}.`),
    );
  }

  function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) {
      setActionError(t('Alasan pembatalan wajib diisi.', 'Cancellation reason is required.'));
      return;
    }
    void run(() => api(`${orderPath}/cancel`, { method: 'POST', body: { reason: reason.trim() } }), t('Order dibatalkan.', 'Order cancelled.'));
  }

  // Unggah satu lampiran (multipart) ke POST /admin/orders/{number}/attachments.
  async function uploadAttachment(file: File, label = ''): Promise<void> {
    const fd = new FormData();
    fd.append('file', file);
    if (label.trim()) fd.append('label', label.trim());
    await apiUpload(`${orderPath}/attachments`, fd);
  }

  async function submitShip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const files = shipFiles;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      // Loco: tanpa kurir dan resi (server tidak mewajibkannya untuk order pickup). FOB/CIF: nama kapal + nomor B/L wajib,
      // voyage dan tanggal B/L opsional; server mengisi trackingNumber dengan nomor B/L (kontrak 11.11).
      const shipping: Record<string, string | null> = pickup
        ? {}
        : port
          ? { vesselName: vesselName.trim(), voyage: voyage.trim() || null, blNumber: blNumber.trim(), blDate: blDate || null }
          : { courier: courier.trim(), trackingNumber: trackingNumber.trim() };
      await api(`${orderPath}/status`, { method: 'POST', body: { status: 'shipped', ...shipping, note: note.trim() || null } });
    } catch (err) {
      setActionError(actionErrorText(err, lang));
      setBusy(false);
      return;
    }
    // Status sudah berubah; lampiran menyusul satu per satu. Gagal unggah tidak membatalkan status: modal ditutup,
    // berkas yang gagal dilaporkan dan bisa diunggah ulang dari kartu "Lampiran untuk customer".
    const failed: string[] = [];
    for (const file of files) {
      try {
        await uploadAttachment(file);
      } catch (err) {
        failed.push(`${file.name} (${actionErrorText(err, lang)})`);
      }
    }
    setShipFiles([]);
    await refresh();
    setModal(null);
    setBusy(false);
    const uploaded = files.length - failed.length;
    const marked = pickup
      ? t('Order ditandai siap diambil', 'Order marked as ready for pickup')
      : port
        ? t('Order ditandai dimuat ke kapal', 'Order marked as shipped on board')
        : t('Order ditandai dikirim', 'Order marked as shipped');
    if (failed.length > 0) {
      setActionError(
        t(
          `${marked}, tetapi ${failed.length} lampiran gagal diunggah: ${failed.join('; ')}. Unggah ulang lewat kartu Lampiran.`,
          `${marked}, but ${failed.length} attachment(s) failed: ${failed.join('; ')}. Re-upload from the Attachments card.`,
        ),
      );
    }
    setActionOk(
      uploaded > 0
        ? t(`${marked}. ${uploaded} lampiran diunggah dan customer sudah diberi tahu.`, `${marked}. ${uploaded} attachment(s) uploaded and the customer notified.`)
        : `${marked}.`,
    );
  }

  function submitAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attachFile) return;
    const file = attachFile;
    const label = attachLabel;
    void run(
      async () => {
        await uploadAttachment(file, label);
        setAttachFile(null);
        setAttachLabel('');
      },
      t('Lampiran diunggah. Customer sudah diberi tahu.', 'Attachment uploaded. The customer has been notified.'),
    );
  }

  async function removeAttachment(attachment: OrderAttachment) {
    if (!(await confirmDialog(t(`Hapus lampiran "${attachment.label || attachment.file?.originalName}"?`, `Delete attachment "${attachment.label || attachment.file?.originalName}"?`)))) return;
    void run(() => api(`${orderPath}/attachments/${attachment.id}`, { method: 'DELETE' }), t('Lampiran dihapus.', 'Attachment deleted.'));
  }

  // Catatan perjalanan kiriman (ASUMSI A-70): hanya selama order berstatus dikirim; customer mendapat notifikasi.
  function submitTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = trackNote.trim();
    if (value.length < 3) {
      setActionError(t('Catatan perjalanan minimal 3 karakter.', 'The shipping note needs at least 3 characters.'));
      return;
    }
    void run(
      () => api(`${orderPath}/tracking`, { method: 'POST', body: { note: value } }).then(() => setTrackNote('')),
      t('Catatan perjalanan ditambahkan. Customer sudah diberi tahu.', 'Shipping note added. The customer has been notified.'),
    );
  }

  async function removeTracking(update: TrackingUpdate) {
    if (!await confirmDialog(t(`Hapus catatan "${update.note}"?`, `Delete the note "${update.note}"?`))) return;
    void run(() => api(`${orderPath}/tracking/${update.id}`, { method: 'DELETE' }), t('Catatan perjalanan dihapus.', 'Shipping note deleted.'));
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== 'note') return;
    changeStatus(modal.status, { note: note.trim() || null });
  }

  function submitDue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: Record<string, unknown> = {};
    if (dueMode === 'hours') {
      const hours = Number(extendHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setActionError(t('Jumlah jam harus lebih dari 0.', 'Hours must be greater than 0.'));
        return;
      }
      body.extendHours = hours;
    } else {
      const iso = fromDateTimeLocal(dueAt);
      if (!iso) {
        setActionError(t('Tanggal batas bayar tidak valid.', 'Invalid payment due date.'));
        return;
      }
      body.paymentDueAt = iso;
    }
    void run(() => api(`${orderPath}/due`, { method: 'PUT', body }), t('Batas waktu pembayaran diperbarui.', 'Payment deadline updated.'));
  }

  function acceptPayment(payment: Payment) {
    openModal({ type: 'accept', payment });
  }

  async function paymentAccepted() {
    setModal(null);
    setActionError('');
    refreshAdminBadges();
    await refresh();
    setActionOk(t('Pembayaran diterima. Order kini berstatus Dibayar.', 'Payment accepted. The order is now paid.'));
  }

  function submitReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== 'reject') return;
    if (!reason.trim()) {
      setActionError(t('Alasan penolakan wajib diisi.', 'Rejection reason is required.'));
      return;
    }
    void run(
      () => api(`/admin/payments/${modal.payment.id}/reject`, { method: 'POST', body: { reason: reason.trim() } }),
      t('Bukti pembayaran ditolak. Customer bisa mengunggah ulang.', 'Payment proof rejected. The customer can upload again.'),
    );
  }

  if (loading && !order) {
    return <SessionLoader message={t('Memuat detail order...', 'Loading order details...')} />;
  }

  if (notFound) {
    return (
      <EmptyState
        icon="close"
        title={t('Order tidak ditemukan', 'Order not found')}
        body={t('Transaksi tidak tersedia atau nomor order salah.', 'Transaction is unavailable or the order number is incorrect.')}
        action={{ href: '/admin/orders', label: t('Kembali ke order', 'Back to orders') }}
      />
    );
  }

  if (!order) {
    return (
      <div>
        <p className="form-error">{error || t('Gagal memuat order.', 'Failed to load order.')}</p>
        <button type="button" className="btn btn-line btn-sm" onClick={() => void refresh()}>
          {t('Muat ulang', 'Reload')}
        </button>
      </div>
    );
  }

  const status = orderLabel(order.status, variant);
  const payStatus = paymentLabel(order.paymentStatus);
  // Snapshot alamat order Loco = titik ambil (tanpa kode wilayah); blok alamat customer hanya untuk order diantar.
  const addr = deliveryAddress(order.shippingAddress);
  const portAddr = isPortAddress(order.shippingAddress) ? order.shippingAddress : null;
  // Loco beberapa pabrik (ASUMSI A-90): semua titik ambil + gabungan nama untuk teks modal.
  const pickupPoints = orderPickupPoints(order);
  const pickupLabel = joinNames(pickupPoints.map((point) => pickupPointName(point, lang)), lang);
  const canCancel = adminCancellableStatuses.includes(order.status);
  const canEditDue = dueEditableStatuses.includes(order.status);
  const awaitingPayments = order.payments.filter((p) => p.status === 'awaiting_verification');
  const activeId = order.activePayment?.id ?? order.payment?.id ?? null;
  const taxLabel = order.priceIncludesTax
    ? t(`PPN ${order.taxRate ?? ''}% (termasuk dalam harga)`, `VAT ${order.taxRate ?? ''}% (included in price)`)
    : t(`PPN ${order.taxRate ?? ''}%`, `VAT ${order.taxRate ?? ''}%`);

  return (
    <div>
      <div className="admin-head">
        <div>
          <Link href="/admin/orders" className="link" style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="chevronLeft" size={16} /> {t('Semua order', 'All orders')}
          </Link>
          <h1 className="admin-title mono">{order.number}</h1>
          <div className={styles.headMeta}>
            <span>
              {t('Dibuat', 'Created')} {formatDateTime(order.date, lang)}
            </span>
            {order.invoiceNumber && (
              <span>
                Invoice <span className="mono">{order.invoiceNumber}</span>
              </span>
            )}
            {order.paymentDueAt && !order.paidAt && (
              <span>
                {t('Batas bayar', 'Payment due')} <strong>{formatDateTime(order.paymentDueAt, lang)}</strong>
              </span>
            )}
            {order.paidAt && (
              <span>
                {t('Dibayar', 'Paid')} {formatDateTime(order.paidAt, lang)}
              </span>
            )}
          </div>
        </div>
        <div className={styles.badges}>
          <StatusBadge label={status[lang]} tone={status.tone} />
          <StatusBadge label={payStatus[lang]} tone={payStatus.tone} />
          {/* Order CIF yang menunggu ongkir belum punya total final: invoice disembunyikan sampai penawaran disepakati.
              Order USD baru punya dokumen cetak setelah dibayar (commercial invoice) atau setelah proforma dibuat. */}
          {!awaitingFreight && (order.currency !== 'USD' || !!order.paidAt || !!order.proforma) && (
            <a href={`/print/invoice/${encodeURIComponent(order.number)}`} target="_blank" rel="noopener" className="btn btn-line btn-sm">
              <Icon name="arrowDown" size={15} /> {t('Cetak invoice', 'Print invoice')}
            </a>
          )}
        </div>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {actionOk && (
        <p className="admin-toast" role="status">
          {actionOk}
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="admin-grid-2">
        <AdminCard title={t('Item pesanan', 'Order items')}>
          {order.items.map((item) => (
            <div key={item.id ?? item.productSlug} className={styles.item}>
              <span className={styles.itemThumb}>
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" />
                ) : (
                  <Icon name="image" size={18} />
                )}
              </span>
              <span className={styles.itemName}>
                <strong>{tr(item.name, lang)}</strong>
                <small>
                  {item.code} · {item.qty} {item.unit} × {formatIDR(item.unitPrice)}
                  {item.discountAmount > 0 && ` · ${t('diskon', 'discount')} −${formatIDR(item.discountAmount)}`}
                </small>
              </span>
              <span className={styles.itemTotal}>
                {formatIDR(item.lineTotal - (item.discountAmount || 0))}
                {item.productSlug && (
                  <small>
                    <Link href={`/catalog/${item.productSlug}`} className="link" target="_blank">
                      {t('lihat produk', 'view product')}
                    </Link>
                  </small>
                )}
              </span>
            </div>
          ))}

          <div className={styles.summaryRow} style={{ marginTop: 12 }}>
            <span>Subtotal</span>
            <span>{formatIDR(order.subtotal)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className={styles.summaryRow}>
              <span>
                {t('Diskon', 'Discount')}
                {order.voucherCode && <small> · {t('voucher', 'voucher')} {order.voucherCode}</small>}
              </span>
              <span>−{formatIDR(order.discountTotal)}</span>
            </div>
          )}
          {agreedLines.length > 0 ? (
            // Ongkir CIF yang disepakati (ASUMSI A-89): baris Freight / Port charges / Insurance menggantikan satu baris Ongkir.
            agreedLines.map((line, i) => (
              <div key={`line-${i}`} className={styles.summaryRow}>
                <span>{freightLineLabel(line.label, lang)}</span>
                <span>{formatIDR(line.amount)}</span>
              </div>
            ))
          ) : (
            <div className={styles.summaryRow}>
              <span>
                {t('Ongkir', 'Shipping')}
                {order.shippingMethod && (
                  <small>
                    {' '}
                    · {tr(order.shippingMethod.label, lang)}
                    {order.shippingMethod.eta ? ` (${tr(order.shippingMethod.eta, lang)})` : ''}
                    {shipmentMetricsText(order.shippingMethod) ? ` · ${shipmentMetricsText(order.shippingMethod)}` : ''}
                    {order.shippingMethod.breakdown && order.shippingMethod.type !== 'flat' && !order.shippingMethod.breakdown.free && !hasMultipleOrigins(order.shippingMethod) && (
                      <span className="admin-cell-sub">{shippingBreakdownText(order.shippingMethod.breakdown, lang)}</span>
                    )}
                    {hasMultipleOrigins(order.shippingMethod) &&
                      order.shippingMethod.origins?.map((origin, index) => (
                        <span key={origin.factory?.code || index} className="admin-cell-sub">
                          {shippingOriginText(origin, lang)}
                          {origin.breakdown && !origin.breakdown.free && order.shippingMethod?.type !== 'flat' ? ` (${shippingBreakdownText(origin.breakdown, lang)})` : ''}
                        </span>
                      ))}
                  </small>
                )}
              </span>
              <span>{awaitingFreight ? t('Menunggu penawaran', 'To be quoted') : formatIDR(order.shippingTotal)}</span>
            </div>
          )}
          {(order.fees ?? []).map((fee) => (
            <div key={fee.id} className={styles.summaryRow}>
              <span>{tr(fee.name, lang)}</span>
              <span>{formatIDR(fee.amount)}</span>
            </div>
          ))}
          {(!order.fees || order.fees.length === 0) && order.feeTotal > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('Biaya tambahan', 'Additional fees')}</span>
              <span>{formatIDR(order.feeTotal)}</span>
            </div>
          )}
          {order.taxTotal > 0 && (
            <div className={`${styles.summaryRow} ${order.priceIncludesTax ? styles.summaryMuted : ''}`}>
              <span>{taxLabel}</span>
              <span>{order.priceIncludesTax ? `(${formatIDR(order.taxTotal)})` : formatIDR(order.taxTotal)}</span>
            </div>
          )}
          {order.uniqueCode > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('Kode unik transfer', 'Transfer unique code')}</span>
              <span>{formatIDR(order.uniqueCode)}</span>
            </div>
          )}
          <div className={`${styles.summaryRow} ${styles.total}`}>
            <span>Total{order.currency === 'USD' ? ' (USD)' : ''}{awaitingFreight ? ` (${t('sementara, tanpa ongkir', 'provisional, before freight')})` : ''}</span>
            <span>{formatIDR(order.grandTotal)}</span>
          </div>
          {order.paymentTerm && (
            <div className={`${styles.summaryRow} ${styles.summaryMuted}`}>
              <span>{t('Syarat pembayaran', 'Payment terms')}</span>
              <span>{tr(order.paymentTerm.name, lang)}</span>
            </div>
          )}
          {order.note && (
            <p className={styles.note}>
              <strong>{t('Catatan customer', 'Customer note')}:</strong> {order.note}
            </p>
          )}
          {order.cancelReason && (
            <p className={styles.note}>
              <strong>{t('Alasan pembatalan', 'Cancellation reason')}:</strong> {order.cancelReason}
            </p>
          )}
        </AdminCard>

        <AdminCard title={t('Customer & pengiriman', 'Customer & shipping')}>
          <p className={styles.address}>
            <strong>{order.customer.company || order.customer.name}</strong>
            <br />
            PIC: {order.customer.pic || order.customer.name}
            <br />
            <span className="mono">{order.customer.email}</span>
            {order.customer.phone && (
              <>
                <br />
                {t('Telepon', 'Phone')}: {order.customer.phone}
              </>
            )}
            {order.customer.taxId && (
              <>
                <br />
                NPWP: <span className="mono">{order.customer.taxId}</span>
              </>
            )}
            {order.customer.market && (
              <>
                <br />
                {t('Pasar', 'Market')}: {order.customer.market === 'export' ? t('Ekspor', 'Export') : t('Lokal', 'Local')} ({order.currency})
                {order.customer.countryCode ? ` · ${order.customer.countryCode}` : ''}
              </>
            )}
            <br />
            <Link href={`/admin/customers?q=${encodeURIComponent(order.customer.email)}`} className="link">
              {t('Lihat profil customer', 'View customer profile')}
            </Link>
            {' · '}
            <Link href={`/admin/chat?customer=${order.customer.id}`} className="link">
              {t('Chat customer', 'Chat with customer')}
            </Link>
          </p>
          <hr className={styles.divider} />
          {port ? (
            <p className={styles.address}>
              <strong>
                {t('Serah terima', 'Delivery')}: {tr(order.deliveryTerm?.name ?? portAddr?.label, lang) || `FOB ${portAddr?.loadingPort || order.deliveryTerm?.loadingPort || ''}`}
              </strong>
              <br />
              {t('Pelabuhan muat', 'Loading port')}: {portAddr?.loadingPort || order.deliveryTerm?.loadingPort || '—'}
              <br />
              <br />
              <strong>{portAddr?.companyName || order.customer.company || order.customer.name}</strong>
              <br />
              {portAddr?.companyAddress || order.customer.companyAddress || t('Alamat perusahaan belum diisi customer.', 'Company address not filled in by the customer.')}
              {(portAddr?.countryCode || order.customer.countryCode) ? ` · ${portAddr?.countryCode || order.customer.countryCode}` : ''}
              <br />
              {portAddr?.recipientName || order.customer.pic || order.customer.name}
              {(portAddr?.phone || order.customer.phone) ? ` · ${portAddr?.phone || order.customer.phone}` : ''}
              {order.destinationPort && (
                <>
                  <br />
                  {t('Pelabuhan tujuan', 'Destination port')}: {[order.destinationPort.name, order.destinationPort.country].filter(Boolean).join(', ')}
                </>
              )}
              {order.shipmentDetails && (
                <>
                  <br />
                  <br />
                  <strong>{t('Dimuat ke kapal', 'Shipped on board')}</strong>
                  <br />
                  {t('Kapal', 'Vessel')}: {order.shipmentDetails.vessel || '—'}
                  {order.shipmentDetails.voyage ? ` · Voyage ${order.shipmentDetails.voyage}` : ''}
                  <br />
                  {t('No. B/L', 'B/L no.')}: <strong className="mono">{order.shipmentDetails.blNumber || '—'}</strong>
                  {order.shipmentDetails.blDate ? ` · ${t('Tanggal B/L', 'B/L date')} ${formatDate(order.shipmentDetails.blDate, lang)}` : ''}
                </>
              )}
              {order.shippedAt && (
                <>
                  <br />
                  <small>
                    {t('Dimuat', 'Shipped on board')} {formatDateTime(order.shippedAt, lang)}
                    {order.deliveredAt ? ` · ${t('diterima', 'delivered')} ${formatDateTime(order.deliveredAt, lang)}` : ''}
                  </small>
                </>
              )}
            </p>
          ) : pickup ? (
            <p className={styles.address}>
              {pickupPoints.length === 0 && (
                <>
                  <strong>{t('Loco: ambil di pabrik', 'Loco: pickup at the factory')}</strong>
                  <br />
                  {t('Alamat titik ambil belum diatur.', 'Pickup address not set.')}
                </>
              )}
              {pickupPoints.map((point, index) => {
                const names = pickupItemNames(point, order.items, lang);
                return (
                  <span key={point.code || `point-${index}`} style={{ display: 'block', marginBottom: index < pickupPoints.length - 1 ? 10 : 0 }}>
                    <strong>
                      {t('Loco: ambil di', 'Loco: pickup at')} {pickupPointName(point, lang) || t('pabrik', 'the factory')}
                    </strong>
                    <br />
                    {point.address || t('Alamat titik ambil belum diatur.', 'Pickup address not set.')}
                    {point.lat != null && point.lng != null && (
                      <>
                        <br />
                        <a className="link" href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`} target="_blank" rel="noopener noreferrer">
                          {t('Lihat di peta', 'View on map')} ({point.lat}, {point.lng})
                        </a>
                      </>
                    )}
                    {names.length > 0 && (
                      <>
                        <br />
                        <small>
                          {t('Diambil di sini', 'Collected here')}: {names.join(', ')}
                        </small>
                      </>
                    )}
                  </span>
                );
              })}
              {order.shippedAt && (
                <>
                  <br />
                  <small>
                    {t('Siap diambil', 'Ready for pickup')} {formatDateTime(order.shippedAt, lang)}
                    {order.deliveredAt ? ` · ${t('diambil', 'picked up')} ${formatDateTime(order.deliveredAt, lang)}` : ''}
                  </small>
                </>
              )}
            </p>
          ) : (
            <p className={styles.address}>
              <strong>
                {addr?.label ? `${addr.label} · ` : ''}
                {addr?.recipientName}
              </strong>
              <br />
              {addr?.phone}
              <br />
              {addr?.addressLine}
              <br />
              {[addr?.region?.village, addr?.region?.district, addr?.region?.regency, addr?.region?.province].filter(Boolean).join(', ')}
              {addr?.postalCode ? ` ${addr.postalCode}` : ''}
              {addr?.note && (
                <>
                  <br />
                  <em>{addr.note}</em>
                </>
              )}
              {addr && addr.lat != null && addr.lng != null && (
                <>
                  <br />
                  <a className="link" href={`https://www.openstreetmap.org/?mlat=${addr.lat}&mlon=${addr.lng}#map=17/${addr.lat}/${addr.lng}`} target="_blank" rel="noopener noreferrer">
                    {t('Lihat di peta', 'View on map')} ({addr.lat}, {addr.lng})
                  </a>
                </>
              )}
              {order.deliveryTerm?.name && (
                <>
                  <br />
                  <small>
                    {t('Serah terima', 'Delivery term')}: {tr(order.deliveryTerm.name, lang)}
                  </small>
                </>
              )}
            </p>
          )}
          {!pickup && !port && (order.courier || order.trackingNumber) && (
            <p className={styles.trackingNumber}>
              {t('Kurir', 'Courier')}: <strong>{order.courier || '—'}</strong> · {t('No. resi', 'Tracking No.')}:{' '}
              <strong className="mono">{order.trackingNumber || '—'}</strong>
              {order.shippedAt && (
                <>
                  <br />
                  <small>
                    {t('Dikirim', 'Shipped')} {formatDateTime(order.shippedAt, lang)}
                    {order.deliveredAt ? ` · ${t('diterima', 'delivered')} ${formatDateTime(order.deliveredAt, lang)}` : ''}
                  </small>
                </>
              )}
            </p>
          )}
        </AdminCard>
      </div>

      <div className="admin-grid-2" style={{ marginTop: 20 }}>
        <AdminCard title={t('Pembayaran', 'Payments')} desc={t('Setiap percobaan bayar tercatat terpisah. Yang aktif ditandai.', 'Each payment attempt is recorded separately. The active one is highlighted.')}>
          {order.payments.length === 0 && <p className="admin-field-hint">{t('Belum ada percobaan pembayaran.', 'No payment attempts yet.')}</p>}
          <div className={styles.paymentList}>
            {[...order.payments].reverse().map((payment) => {
              const label = paymentLabel(payment.status);
              const isActive = payment.id === activeId;
              return (
                <div key={payment.id} className={`${styles.payment} ${isActive ? styles.paymentActive : ''}`}>
                  <div className={styles.paymentHead}>
                    <strong>
                      #{payment.id} · {paymentMethodSummary(payment, lang)}
                    </strong>
                    <StatusBadge label={label[lang]} tone={label.tone} small />
                  </div>
                  <div className={styles.paymentMeta}>
                    <span>
                      {t('Jumlah', 'Amount')}: <b>{formatMoney(payment.amount, payment.currency || order.currency)}</b>
                      {payment.uniqueCode ? ` (${t('kode unik', 'unique code')} ${payment.uniqueCode})` : ''}
                    </span>
                    {(payment.receivedAmount != null || payment.bankCharges != null || payment.receivedNote) && (
                      <span>
                        {t('Diterima', 'Received')}:{' '}
                        {payment.receivedAmount != null && <b>{formatMoney(payment.receivedAmount, payment.currency || order.currency)}</b>}
                        {payment.bankCharges != null ? ` · ${t('biaya bank', 'bank charges')} ${formatMoney(payment.bankCharges, payment.currency || order.currency)}` : ''}
                        {payment.receivedNote ? ` · ${payment.receivedNote}` : ''}
                      </span>
                    )}
                    <span>
                      {t('Dibuat', 'Created')}: {formatDateTime(payment.createdAt, lang)}
                    </span>
                    {payment.bankAccount && (
                      <span>
                        {t('Rekening', 'Account')}: {payment.bankAccount.bankName} {payment.bankAccount.accountNumber}
                        {payment.bankAccount.currency && payment.bankAccount.currency !== 'IDR' ? ` (${payment.bankAccount.currency}${payment.bankAccount.swiftCode ? `, SWIFT ${payment.bankAccount.swiftCode}` : ''})` : ''}
                      </span>
                    )}
                    {payment.expiresAt && payment.status === 'pending' && (
                      <span>
                        {t('Kedaluwarsa', 'Expires')}: {formatDateTime(payment.expiresAt, lang)}
                      </span>
                    )}
                    {payment.proof && (
                      <div className={`${styles.proofBox} ${payment.status === 'awaiting_verification' ? styles.proofBoxHot : ''}`}>
                        {(payment.proof.mime || '').startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={payment.proof.url || `/api/v1/files/${payment.proof.mediaId}`} alt="" className={styles.proofThumb} />
                        ) : (
                          <span className={styles.proofDoc}>{(payment.proof.mime || '').includes('pdf') ? 'PDF' : t('BERKAS', 'FILE')}</span>
                        )}
                        <span className={styles.proofMeta}>
                          <strong>{t('Bukti pembayaran', 'Payment proof')}</strong>
                          <small>
                            {payment.proof.originalName} · {formatDateTime(payment.proof.uploadedAt, lang)}
                          </small>
                          <FileLink file={{ url: payment.proof.url || `/api/v1/files/${payment.proof.mediaId}`, name: payment.proof.originalName, mime: payment.proof.mime }} className="btn btn-line btn-sm">
                            <Icon name="eye" size={15} /> {t('Lihat bukti', 'View proof')}
                          </FileLink>
                        </span>
                      </div>
                    )}
                    {payment.paidAt && (
                      <span>
                        {t('Dibayar', 'Paid')}: {formatDateTime(payment.paidAt, lang)}
                      </span>
                    )}
                    {payment.verifiedBy && (
                      <span>
                        {t('Diverifikasi', 'Verified')}: {payment.verifiedBy.name}
                        {payment.verifiedAt ? ` · ${formatDateTime(payment.verifiedAt, lang)}` : ''}
                      </span>
                    )}
                    {payment.rejectReason && (
                      <span>
                        {t('Alasan tolak', 'Reject reason')}: <b>{payment.rejectReason}</b>
                      </span>
                    )}
                    {payment.externalId && (
                      <span>
                        Ref: <span className="mono">{payment.externalId}</span>
                      </span>
                    )}
                  </div>
                  {payment.status === 'awaiting_verification' && (
                    <div className={styles.paymentActions}>
                      <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => acceptPayment(payment)}>
                        <Icon name="check" size={14} /> {t('Terima pembayaran', 'Accept payment')}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => openModal({ type: 'reject', payment })}>
                        {t('Tolak bukti…', 'Reject proof…')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {awaitingPayments.length === 0 && order.status === 'pending_payment' && (
            <p className="admin-field-hint" style={{ marginTop: 12 }}>
              {t('Customer belum mengunggah bukti pembayaran.', 'The customer has not uploaded a payment proof yet.')}
            </p>
          )}
          {awaitingFreight && (
            <p className="admin-field-hint" style={{ marginTop: 12 }}>
              {t('Order CIF: tagihan, batas bayar, dan instruksi pembayaran dibuat otomatis setelah penawaran ongkir disepakati.', 'CIF order: the bill, payment deadline, and payment instructions are created automatically once the freight quote is agreed.')}
              {order.pendingPaymentMethod?.code ? ` ${t('Metode yang dipilih customer', 'Method chosen by the customer')}: ${order.pendingPaymentMethod.code}.` : ''}
            </p>
          )}
        </AdminCard>

        <AdminCard title={t('Lacak & aksi order', 'Tracking & order actions')}>
          <OrderTracking order={order} onRemoveUpdate={order.canAddTracking ? removeTracking : undefined} removeDisabled={busy} pickup={pickup} port={port} />

          {order.canAddTracking && (
            <form className={styles.trackForm} onSubmit={submitTracking}>
              <label htmlFor="track-note" className="field-label">
                {t('Tambah catatan perjalanan', 'Add a shipping note')}
              </label>
              <div className={styles.trackRow}>
                <input
                  id="track-note"
                  value={trackNote}
                  maxLength={200}
                  onChange={(e) => setTrackNote(e.target.value)}
                  placeholder={t('mis. Pesanan tiba di Provinsi Riau', 'e.g. The parcel has arrived in Riau Province')}
                />
                <button type="submit" className="btn btn-line btn-sm" disabled={busy || trackNote.trim().length < 3}>
                  <Icon name="plus" size={14} /> {t('Tambah', 'Add')}
                </button>
              </div>
              <p className="admin-field-hint">
                {t(
                  'Tampil berurutan di bawah "Dikirim" pada halaman pesanan customer, dan customer mendapat notifikasi. Bisa ditambah berkali-kali sampai pesanan diterima.',
                  'Shown in order under "Shipped" on the customer order page, and the customer gets a notification. Add as many as needed until the order is delivered.',
                )}
              </p>
            </form>
          )}

          <div className={styles.actionGroup}>
            {order.status === 'paid' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'note', status: 'processing' })}>
                <Icon name="gear" size={14} /> {t('Mulai proses', 'Start processing')}
              </button>
            )}
            {order.status === 'processing' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'ship' })}>
                <Icon name={pickup ? 'factory' : port ? 'globe' : 'truck'} size={14} />{' '}
                {pickup ? t('Tandai siap diambil…', 'Mark as ready for pickup…') : port ? t('Tandai dimuat ke kapal…', 'Mark as shipped on board…') : t('Tandai dikirim…', 'Mark as shipped…')}
              </button>
            )}
            {order.status === 'shipped' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'note', status: 'delivered' })}>
                <Icon name={pickup ? 'check' : 'package'} size={14} /> {pickup ? t('Tandai sudah diambil', 'Mark as picked up') : t('Tandai diterima', 'Mark as delivered')}
              </button>
            )}
            {order.status === 'delivered' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'note', status: 'completed' })}>
                <Icon name="checkCircle" size={14} /> {t('Selesaikan order', 'Complete order')}
              </button>
            )}
            {canEditDue && (
              <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => openModal({ type: 'due' })}>
                {t('Perpanjang batas bayar…', 'Extend payment deadline…')}
              </button>
            )}
            {canCancel && (
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => openModal({ type: 'cancel' })}>
                {t('Batalkan order…', 'Cancel order…')}
              </button>
            )}
          </div>
          {order.status === 'completed' && (
            <p className="admin-field-hint" style={{ marginTop: 12 }}>
              {t('Order selesai', 'Order completed')} {order.completedAt ? formatDateTime(order.completedAt, lang) : ''}.
            </p>
          )}
        </AdminCard>
      </div>

      <div style={{ marginTop: 20 }}>
        <AdminCard title={t('Riwayat status', 'Status history')}>
          {order.timeline.length === 0 ? (
            <p className="admin-field-hint">{t('Belum ada riwayat.', 'No history yet.')}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className={styles.timeline}>
                <thead>
                  <tr>
                    <th>{t('Waktu', 'Time')}</th>
                    <th>Status</th>
                    <th>{t('Oleh', 'By')}</th>
                    <th>{t('Catatan', 'Note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...order.timeline].reverse().map((entry, index) => (
                    <tr key={entry.id ?? index}>
                      <td className="mono">{formatDateTime(entry.at, lang)}</td>
                      <td>
                        {entry.fromStatus ? `${orderLabel(entry.fromStatus, variant)[lang]} → ` : ''}
                        <strong>{orderLabel(entry.status, variant)[lang]}</strong>
                      </td>
                      <td>{entry.actor?.name || (entry.actorType ? `${entry.actorType}` : t('Sistem', 'System'))}</td>
                      <td>{entry.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>

      {quoted && (
        <div style={{ marginTop: 20 }}>
          <AdminCard
            title={t('Penawaran ongkir', 'Freight quote')}
            desc={t(
              'Order CIF: ongkos kapal, biaya pelabuhan, dan asuransi sampai pelabuhan tujuan ditawarkan per order. Customer menyetujui atau mengajukan harga balasan; setelah disepakati total order dihitung ulang dan instruksi pembayaran dibuat.',
              'CIF order: ocean freight, port charges, and insurance to the destination port are quoted per order. The customer accepts or counters; once agreed the order total is recalculated and payment instructions are issued.',
            )}
          >
            <div className="fq-port">
              <span>
                <small>{t('Pelabuhan muat', 'Loading port')}</small>
                <strong>{portAddr?.loadingPort || order.deliveryTerm?.loadingPort || '—'}</strong>
              </span>
              <span>
                <small>{t('Pelabuhan tujuan', 'Destination port')}</small>
                <strong>{destinationPortText(order.destinationPort) || '—'}</strong>
                {order.destinationPort?.lat != null && order.destinationPort?.lng != null && (
                  <a
                    className="link"
                    href={`https://www.openstreetmap.org/?mlat=${order.destinationPort.lat}&mlon=${order.destinationPort.lng}#map=11/${order.destinationPort.lat}/${order.destinationPort.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('Lihat di peta', 'View on map')}
                  </a>
                )}
              </span>
              <span>
                <small>{t('Putaran', 'Rounds')}</small>
                <strong>{(order.freightQuotes || []).length}</strong>
              </span>
            </div>

            {agreedLines.length > 0 && !awaitingFreight && (
              <>
                <p className="admin-field-hint">{t('Ongkir yang disepakati dan sudah masuk total order:', 'Agreed freight, already included in the order total:')}</p>
                <table className="fq-lines">
                  <tbody>
                    {agreedLines.map((line, i) => (
                      <tr key={`agreed-${i}`}>
                        <td>{freightLineLabel(line.label, lang)}</td>
                        <td>{formatIDR(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{t('Total ongkir', 'Freight total')}</td>
                      <td>{formatIDR(order.shippingTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}

            {activeQuote ? (
              <>
                <p className="admin-field-hint">
                  {activeQuote.proposedBy === 'admin'
                    ? t(`Penawaran admin putaran ${activeQuote.round} menunggu tanggapan customer.`, `Admin quote round ${activeQuote.round} is awaiting the customer response.`)
                    : t(`Harga balasan customer (putaran ${activeQuote.round}): terima, atau kirim penawaran baru.`, `Customer counter price (round ${activeQuote.round}): accept it, or send a new quote.`)}
                </p>
                <table className="fq-lines">
                  <tbody>
                    {activeQuote.lines.map((line, i) => (
                      <tr key={`${activeQuote.id}-${i}`}>
                        <td>{freightLineLabel(line.label, lang)}</td>
                        <td>{formatIDR(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total{order.currency === 'USD' ? ' (USD)' : ''}</td>
                      <td>{formatIDR(activeQuote.total)}</td>
                    </tr>
                  </tfoot>
                </table>
                <p className="fq-meta">
                  <span>
                    {t('Diajukan', 'Proposed')} {formatDateTime(activeQuote.createdAt, lang)}
                    {activeQuote.createdBy ? ` · ${activeQuote.createdBy.name}` : ''}
                  </span>
                  {activeQuote.validUntil && (
                    <span>
                      {t('Berlaku sampai', 'Valid until')} {formatDateTime(activeQuote.validUntil, lang)}
                    </span>
                  )}
                  {activeQuote.expired && <StatusBadge label={t('Kedaluwarsa', 'Expired')} tone="bad" small />}
                </p>
                {activeQuote.note && <p className="fq-note">{activeQuote.note}</p>}
              </>
            ) : awaitingFreight ? (
              <p className="admin-field-hint">{t('Belum ada penawaran yang terbuka. Beri penawaran agar customer bisa menyetujui atau mengajukan harga lain.', 'No open quote yet. Send a quote so the customer can accept it or counter.')}</p>
            ) : null}

            {order.canQuoteFreight && (
              <div className={styles.actionGroup}>
                {activeQuote?.proposedBy === 'customer' && !activeQuote.expired && (
                  <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => void acceptCounter(activeQuote)}>
                    <Icon name="check" size={14} /> {t('Terima balasan customer', 'Accept customer counter')}
                  </button>
                )}
                <button type="button" className={`btn ${activeQuote?.proposedBy === 'customer' ? 'btn-line' : 'btn-solid'} btn-sm`} disabled={busy} onClick={openFreightModal}>
                  <Icon name="plus" size={14} /> {activeQuote ? t('Beri penawaran baru…', 'Send a new quote…') : t('Beri penawaran…', 'Send a quote…')}
                </button>
                {activeQuote?.proposedBy === 'admin' && activeQuote.expired && (
                  <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => openExtendModal(activeQuote)}>
                    <Icon name="clock" size={14} /> {t('Perpanjang masa berlaku…', 'Extend validity…')}
                  </button>
                )}
              </div>
            )}

            {(order.freightQuotes || []).length > 0 && (
              <div className="fq-history">
                <h3>{t('Riwayat putaran', 'Round history')}</h3>
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Putaran', 'Round')}</th>
                        <th>{t('Oleh', 'By')}</th>
                        <th className="num">Total</th>
                        <th>{t('Berlaku sampai', 'Valid until')}</th>
                        <th>Status</th>
                        <th>{t('Tanggal', 'Date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.freightQuotes || []).map((q) => {
                        const ql = freightQuoteLabel(q);
                        return (
                          <tr key={q.id}>
                            <td className="mono">#{q.round}</td>
                            <td>{q.proposedBy === 'admin' ? q.createdBy?.name || 'Admin' : 'Customer'}</td>
                            <td className="num">{formatIDR(q.total)}</td>
                            <td>{q.validUntil ? formatDateTime(q.validUntil, lang) : '—'}</td>
                            <td>
                              <StatusBadge label={ql[lang]} tone={ql.tone} small />
                            </td>
                            <td className="mono">{formatDateTime(q.createdAt, lang)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </AdminCard>
        </div>
      )}

      {showProforma && (
        <div style={{ marginTop: 20 }}>
          <AdminCard
            title={t('Proforma invoice', 'Proforma invoice')}
            desc={t(
              `Dokumen penawaran untuk customer ekspor dengan nomor tetap PI/${order.number}. Setiap simpan menjadi revisi baru dan customer menerima email serta notifikasi.`,
              `Quotation document for the export customer with the fixed number PI/${order.number}. Every save becomes a new revision and the customer is emailed and notified.`,
            )}
          >
            {order.proforma ? (
              <div className="pf-summary">
                <div className="pf-head">
                  <strong className="mono">{order.proforma.label}</strong>
                  <StatusBadge label={`${t('Revisi', 'Revision')} ${order.proforma.revision}`} tone="info" small />
                </div>
                <dl className="pf-meta">
                  <dt>{t('Diterbitkan', 'Issued')}</dt>
                  <dd>{formatDateTime(order.proforma.issuedAt, lang)}</dd>
                  <dt>{t('Diperbarui', 'Updated')}</dt>
                  <dd>
                    {formatDateTime(order.proforma.updatedAt, lang)}
                    {order.proforma.updatedBy ? ` · ${order.proforma.updatedBy.name}` : ''}
                  </dd>
                  <dt>{t('Kapal / voyage', 'Vessel / voyage')}</dt>
                  <dd>{order.proforma.vesselName ? `${order.proforma.vesselName}${order.proforma.voyage ? ` / ${order.proforma.voyage}` : ''}` : '—'}</dd>
                  <dt>ETD / ETA</dt>
                  <dd>
                    {order.proforma.etd ? formatDate(order.proforma.etd, lang) : '—'} / {order.proforma.eta ? formatDate(order.proforma.eta, lang) : '—'}
                  </dd>
                  <dt>{t('Pelabuhan muat / bongkar', 'Port of loading / discharge')}</dt>
                  <dd>
                    {order.proforma.portOfLoading || '—'} / {order.proforma.portOfDischarge || '—'}
                  </dd>
                  <dt>{t('Syarat pembayaran', 'Payment terms')}</dt>
                  <dd>{order.proforma.paymentTerms || '—'}</dd>
                  <dt>{t('Berlaku sampai', 'Valid until')}</dt>
                  <dd>{order.proforma.validUntil ? formatDate(order.proforma.validUntil, lang) : '—'}</dd>
                </dl>
              </div>
            ) : (
              <p className="admin-field-hint">
                {t('Belum ada proforma untuk order ini. Buat proforma agar customer menerima dokumen penawaran dengan rincian kapal, pelabuhan, dan syarat pembayaran.', 'No proforma for this order yet. Create one so the customer receives the quotation document with vessel, port, and payment term details.')}
              </p>
            )}
            <div className={styles.actionGroup}>
              {order.canEditProforma && (
                <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={openProforma}>
                  <Icon name={order.proforma ? 'gear' : 'plus'} size={14} /> {order.proforma ? t('Perbarui proforma…', 'Update proforma…') : t('Buat proforma…', 'Create proforma…')}
                </button>
              )}
              {order.proforma && (
                <a href={`/print/proforma/${encodeURIComponent(order.number)}`} target="_blank" rel="noopener" className="btn btn-line btn-sm">
                  <Icon name="arrowDown" size={15} /> {t('Cetak proforma', 'Print proforma')}
                </a>
              )}
            </div>
          </AdminCard>
        </div>
      )}

      {(order.canAttach || (order.attachments || []).length > 0) && (
        <div style={{ marginTop: 20 }}>
          <AdminCard
            title={t('Lampiran untuk customer', 'Attachments for the customer')}
            desc={
              port
                ? t('Packing list, B/L, certificate of origin, COA, atau dokumen ekspor lain. Berkas privat: hanya admin dan customer pemilik order yang bisa membukanya.', 'Packing list, B/L, certificate of origin, COA, or other export documents. Private files: only admins and the order owner can open them.')
                : t('Faktur pajak, surat jalan, atau dokumen lain. Berkas privat: hanya admin dan customer pemilik order yang bisa membukanya.', 'Tax invoice, delivery note, or other documents. Private files: only admins and the order owner can open them.')
            }
          >
            {(order.attachments || []).length === 0 ? (
              <p className="admin-field-hint">{t('Belum ada lampiran.', 'No attachments yet.')}</p>
            ) : (
              <ul className={styles.fileList}>
                {(order.attachments || []).map((file) => (
                  <li key={file.id} className={styles.fileRow}>
                    <span className={styles.fileIcon}>
                      <Icon name="orders" size={18} />
                    </span>
                    <span className={styles.fileBody}>
                      <FileLink file={file.file ? { url: file.file.url, name: file.file.originalName, mime: file.file.mime } : null} className="link">
                        {file.label || file.file?.originalName}
                      </FileLink>
                      <small className="admin-cell-sub">
                        {file.file?.originalName}
                        {file.file ? ` · ${Math.max(1, Math.round(file.file.size / 1024))} KB` : ''} · {formatDateTime(file.at, lang)}
                        {file.actor ? ` · ${file.actor.name}` : ''}
                      </small>
                    </span>
                    {order.canAttach && (
                      <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => void removeAttachment(file)}>
                        {t('Hapus', 'Delete')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {order.canAttach && (
              <form className={styles.attachForm} onSubmit={submitAttachment}>
                <div className="admin-region-chips pf-chips" aria-label={t('Keterangan cepat', 'Quick labels')}>
                  {(port ? ATTACHMENT_CHIPS_EXPORT : ATTACHMENT_CHIPS_LOCAL).map((chip) => (
                    <button key={chip} type="button" className={`admin-chip admin-chip-static pf-chip ${attachLabel === chip ? 'is-active' : ''}`} onClick={() => setAttachLabel(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setAttachFile(e.target.files?.[0] || null)} />
                <input value={attachLabel} maxLength={120} onChange={(e) => setAttachLabel(e.target.value)} placeholder={t('Keterangan, mis. Faktur Pajak 010.000-26.00000001', 'Label, e.g. Tax Invoice 010.000-26.00000001')} />
                <button type="submit" className="btn btn-solid btn-sm" disabled={busy || !attachFile}>
                  <Icon name="plus" size={14} /> {t('Unggah lampiran', 'Upload attachment')}
                </button>
              </form>
            )}
          </AdminCard>
        </div>
      )}

      {modal?.type === 'cancel' && (
        <AdminModal title={t('Batalkan order', 'Cancel order')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitCancel}>
            <p className="admin-field-hint">
              {t(
                'Stok yang direservasi akan dikembalikan dan customer diberi tahu lewat email. Tindakan ini tidak dapat dibatalkan.',
                'Reserved stock is released and the customer is notified by email. This cannot be undone.',
              )}
            </p>
            <label>
              <span className="field-label">{t('Alasan pembatalan', 'Cancellation reason')} *</span>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Kembali', 'Back')}
              </button>
              <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
                {busy ? t('Memproses...', 'Processing...') : t('Ya, batalkan order', 'Yes, cancel order')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'ship' && (
        <AdminModal
          title={pickup ? t('Tandai siap diambil', 'Mark as ready for pickup') : port ? t('Tandai dimuat ke kapal', 'Mark as shipped on board') : t('Tandai dikirim', 'Mark as shipped')}
          onClose={() => setModal(null)}
          small
        >
          <form className="admin-form" onSubmit={(e) => void submitShip(e)}>
            {pickup ? (
              <p className="admin-field-hint">
                {t(
                  `Customer diberi tahu bahwa barang siap diambil di ${pickupLabel || 'pabrik'}. Tanpa kurir dan nomor resi; lampirkan DO/SPPB bila ada.`,
                  `The customer is notified that the goods are ready for pickup at ${pickupLabel || 'the factory'}. No courier or tracking number; attach the DO/SPPB if available.`,
                )}
              </p>
            ) : port ? (
              <>
                <p className="admin-field-hint">
                  {t(
                    'Order FOB/CIF: catat nama kapal dan nomor B/L (bukan kurir dan resi). Nomor B/L mengisi kolom resi, customer menerima email dan notifikasi "dimuat ke kapal". Lampirkan packing list dan B/L bila sudah ada.',
                    'FOB/CIF order: record the vessel name and B/L number (instead of courier and tracking). The B/L number fills the tracking column and the customer receives a "shipped on board" email and notification. Attach the packing list and B/L if available.',
                  )}
                </p>
                <div className="admin-form-row">
                  <label>
                    <span className="field-label">{t('Nama kapal', 'Vessel name')} *</span>
                    <input value={vesselName} maxLength={120} onChange={(e) => setVesselName(e.target.value)} placeholder={t('Contoh: MV Meratus Medan', 'e.g. MV Meratus Medan')} required />
                  </label>
                  <label>
                    <span className="field-label">Voyage</span>
                    <input value={voyage} maxLength={60} onChange={(e) => setVoyage(e.target.value)} placeholder="V.012" />
                  </label>
                </div>
                <div className="admin-form-row">
                  <label>
                    <span className="field-label">{t('Nomor B/L', 'B/L number')} *</span>
                    <input value={blNumber} maxLength={60} onChange={(e) => setBlNumber(e.target.value)} placeholder="MDN-2026-00123" required />
                  </label>
                  <label>
                    <span className="field-label">{t('Tanggal B/L', 'B/L date')}</span>
                    <input type="date" value={blDate} max={todayIso()} onChange={(e) => setBlDate(e.target.value)} />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label>
                  <span className="field-label">{t('Kurir / ekspedisi', 'Courier')} *</span>
                  <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder={t('Contoh: JNE Trucking', 'e.g. JNE Trucking')} required />
                </label>
                <label>
                  <span className="field-label">{t('Nomor resi', 'Tracking number')} *</span>
                  <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="JNE-000123" required />
                </label>
              </>
            )}
            <label>
              <span className="field-label">{t('Catatan (opsional)', 'Note (optional)')}</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <label>
              <span className="field-label">{t('Lampiran untuk customer (opsional)', 'Attachments for the customer (optional)')}</span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setShipFiles(Array.from(e.target.files || []))}
              />
              <small className="admin-field-hint">
                {t('Faktur pajak, surat jalan, atau dokumen lain (PDF atau gambar JPG/PNG/WebP, maks. 10 MB per berkas). Customer bisa mengunduhnya dari detail pesanan dan akan menerima notifikasi.', 'Tax invoice, delivery note, or other documents (PDF documents or JPG/PNG/WebP images, max. 10 MB each). The customer can download them from the order details and gets a notification.')}
              </small>
              {shipFiles.length > 0 && (
                <small className="admin-field-hint">
                  {shipFiles.map((f) => f.name).join(', ')}
                </small>
              )}
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy
                  ? t('Menyimpan...', 'Saving...')
                  : pickup
                    ? t('Tandai siap diambil', 'Mark as ready for pickup')
                    : port
                      ? t('Tandai dimuat ke kapal', 'Mark as shipped on board')
                      : t('Simpan & tandai dikirim', 'Save & mark shipped')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'proforma' && (
        <AdminModal title={order.proforma ? t('Perbarui proforma invoice', 'Update proforma invoice') : t('Buat proforma invoice', 'Create proforma invoice')} onClose={() => setModal(null)}>
          <form className="admin-form" onSubmit={(e) => void submitProforma(e)}>
            <p className="admin-field-hint">
              {order.proforma
                ? t(
                    `Disimpan sebagai ${order.proforma.number} Rev.${order.proforma.revision + 1}; nomor tidak berubah. Customer menerima email dan notifikasi revisi.`,
                    `Saved as ${order.proforma.number} Rev.${order.proforma.revision + 1}; the number stays the same. The customer is emailed and notified about the revision.`,
                  )
                : t(
                    `Nomor PI/${order.number} tetap untuk semua revisi. Isian yang dikosongkan diisi otomatis dari cara serah terima dan syarat pembayaran order.`,
                    `The number PI/${order.number} stays the same for every revision. Empty fields are filled automatically from the order's delivery term and payment terms.`,
                  )}
            </p>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Nama kapal', 'Vessel name')}</span>
                <input value={pf.vesselName} maxLength={120} onChange={setPfField('vesselName')} placeholder={t('Contoh: MV Meratus Medan', 'e.g. MV Meratus Medan')} />
                {pfErrors.vesselName && <small className="admin-form-error">{pfErrors.vesselName}</small>}
              </label>
              <label>
                <span className="field-label">Voyage</span>
                <input value={pf.voyage} maxLength={60} onChange={setPfField('voyage')} placeholder="V.012" />
                {pfErrors.voyage && <small className="admin-form-error">{pfErrors.voyage}</small>}
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">ETD</span>
                <input type="date" value={pf.etd} onChange={setPfField('etd')} />
                {pfErrors.etd && <small className="admin-form-error">{pfErrors.etd}</small>}
              </label>
              <label>
                <span className="field-label">ETA</span>
                <input type="date" value={pf.eta} onChange={setPfField('eta')} />
                {pfErrors.eta && <small className="admin-form-error">{pfErrors.eta}</small>}
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Pelabuhan muat', 'Port of loading')}</span>
                <input value={pf.portOfLoading} maxLength={120} onChange={setPfField('portOfLoading')} placeholder="Belawan" />
                {pfErrors.portOfLoading && <small className="admin-form-error">{pfErrors.portOfLoading}</small>}
              </label>
              <label>
                <span className="field-label">{t('Pelabuhan bongkar', 'Port of discharge')}</span>
                <input value={pf.portOfDischarge} maxLength={120} onChange={setPfField('portOfDischarge')} placeholder={t('Contoh: Port Klang', 'e.g. Port Klang')} />
                {pfErrors.portOfDischarge && <small className="admin-form-error">{pfErrors.portOfDischarge}</small>}
              </label>
            </div>
            <label>
              <span className="field-label">{t('Syarat pembayaran', 'Payment terms')}</span>
              <textarea rows={2} maxLength={1000} value={pf.paymentTerms} onChange={setPfField('paymentTerms')} placeholder={t('Contoh: 100% T/T in advance', 'e.g. 100% T/T in advance')} />
              {pfErrors.paymentTerms && <small className="admin-form-error">{pfErrors.paymentTerms}</small>}
            </label>
            <label>
              <span className="field-label">{t('Catatan', 'Notes')}</span>
              <textarea rows={3} maxLength={2000} value={pf.notes} onChange={setPfField('notes')} placeholder={t('Dicetak di bagian Notes proforma (opsional).', 'Printed in the Notes section of the proforma (optional).')} />
              {pfErrors.notes && <small className="admin-form-error">{pfErrors.notes}</small>}
            </label>
            <label>
              <span className="field-label">{t('Berlaku sampai', 'Valid until')}</span>
              <input type="date" value={pf.validUntil} onChange={setPfField('validUntil')} />
              {pfErrors.validUntil && <small className="admin-form-error">{pfErrors.validUntil}</small>}
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Menyimpan...', 'Saving...') : order.proforma ? t('Simpan revisi baru', 'Save new revision') : t('Buat proforma', 'Create proforma')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'note' && (
        <AdminModal title={`${t('Ubah status', 'Change status')}: ${orderLabel(modal.status, variant)[lang]}`} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitNote}>
            <p className="admin-field-hint">
              {modal.status === 'processing' && t('Order dibayar akan masuk tahap diproses/dikemas.', 'The paid order moves to processing/packing.')}
              {modal.status === 'delivered' && (pickup ? t('Tandai bahwa barang sudah diambil customer di pabrik.', 'Mark that the customer has picked up the goods at the factory.') : t('Tandai bahwa kiriman sudah diterima customer.', 'Mark that the shipment has been received by the customer.'))}
              {modal.status === 'completed' && t('Order ditutup sebagai selesai.', 'The order is closed as completed.')}
            </p>
            <label>
              <span className="field-label">{t('Catatan (opsional)', 'Note (optional)')}</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Menyimpan...', 'Saving...') : t('Ubah status', 'Change status')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'due' && (
        <AdminModal title={t('Perpanjang batas waktu pembayaran', 'Extend payment deadline')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitDue}>
            <p className="admin-field-hint">
              {t('Batas saat ini', 'Current deadline')}: <strong>{formatDateTime(order.paymentDueAt, lang)}</strong>
            </p>
            <div className="admin-form-row">
              <label className="cms-check">
                <input type="radio" name="dueMode" checked={dueMode === 'hours'} onChange={() => setDueMode('hours')} />
                <span>{t('Tambah jam', 'Add hours')}</span>
              </label>
              <label className="cms-check">
                <input type="radio" name="dueMode" checked={dueMode === 'date'} onChange={() => setDueMode('date')} />
                <span>{t('Tentukan tanggal', 'Set a date')}</span>
              </label>
            </div>
            {dueMode === 'hours' ? (
              <label>
                <span className="field-label">{t('Perpanjang selama', 'Extend by')}</span>
                <Select value={extendHours} onChange={(e) => setExtendHours(e.target.value)}>
                  {EXTEND_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h} {t('jam', 'hours')}
                      {h >= 24 ? ` (${h / 24} ${t('hari', 'days')})` : ''}
                    </option>
                  ))}
                </Select>
                <small className="admin-field-hint">
                  {t('Dihitung dari batas saat ini (atau dari sekarang bila sudah lewat).', 'Counted from the current deadline (or from now if it has passed).')}
                </small>
              </label>
            ) : (
              <label>
                <span className="field-label">{t('Batas bayar baru', 'New deadline')}</span>
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
              </label>
            )}
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Menyimpan...', 'Saving...') : t('Simpan batas waktu', 'Save deadline')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'reject' && (
        <AdminModal title={t('Tolak bukti pembayaran', 'Reject payment proof')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitReject}>
            <p className="admin-field-hint">
              {t('Pembayaran', 'Payment')} #{modal.payment.id} · {formatMoney(modal.payment.amount, modal.payment.currency || order.currency)} · {paymentMethodSummary(modal.payment, lang)}.{' '}
              {t('Order kembali ke "Menunggu pembayaran" dan customer diminta mengunggah ulang.', 'The order returns to "Awaiting payment" and the customer is asked to upload again.')}
            </p>
            <label>
              <span className="field-label">{t('Alasan penolakan', 'Rejection reason')} *</span>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
                {busy ? t('Memproses...', 'Processing...') : t('Tolak bukti', 'Reject proof')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'accept' && (
        <AcceptPaymentModal payment={modal.payment} orderNumber={order.number} onClose={() => setModal(null)} onAccepted={paymentAccepted} />
      )}

      {modal?.type === 'freight' && (
        <AdminModal title={activeQuote ? t('Beri penawaran ongkir baru', 'Send a new freight quote') : t('Beri penawaran ongkir', 'Send freight quote')} onClose={() => setModal(null)}>
          <form className="admin-form" onSubmit={(e) => void submitFreight(e)}>
            <p className="admin-field-hint">
              {t(
                `Rincian ongkos sampai ${destinationPortText(order.destinationPort) || 'pelabuhan tujuan'} dalam ${order.currency}. Customer menerima email dan notifikasi, lalu menyetujui atau mengajukan harga lain.`,
                `Cost breakdown to ${destinationPortText(order.destinationPort) || 'the destination port'} in ${order.currency}. The customer is emailed and notified, then accepts or counters.`,
              )}
              {activeQuote ? ` ${t('Penawaran atau balasan yang masih terbuka diganti oleh penawaran ini.', 'The open quote or counter is superseded by this one.')}` : ''}
            </p>
            <div className="fq-editor">
              {fqLines.map((line, i) => (
                <div key={i} className="fq-editor-row">
                  <label>
                    <span className="field-label">{t('Keterangan biaya', 'Charge description')}</span>
                    <input value={line.label} maxLength={80} list="fq-label-suggestions" onChange={(e) => setFqLine(i, { label: e.target.value })} placeholder={DEFAULT_FREIGHT_LINE_LABELS[i] || 'THC'} />
                    {fqErrors[`lines.${i}.label`] && <small className="admin-form-error">{fqErrors[`lines.${i}.label`]}</small>}
                  </label>
                  <label>
                    <span className="field-label">{t('Jumlah', 'Line amount')} ({order.currency})</span>
                    <input type="number" inputMode="decimal" min={0} step={currencyStep(order.currency)} value={line.amount} onChange={(e) => setFqLine(i, { amount: e.target.value })} placeholder={order.currency === 'USD' ? '0.00' : '0'} className="mono" />
                    {fqErrors[`lines.${i}.amount`] && <small className="admin-form-error">{fqErrors[`lines.${i}.amount`]}</small>}
                  </label>
                  <button
                    type="button"
                    className="row-act fq-remove"
                    disabled={fqLines.length <= 1}
                    onClick={() => setFqLines((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={t('Hapus baris', 'Remove line')}
                    title={t('Hapus baris', 'Remove line')}
                  >
                    ×
                  </button>
                </div>
              ))}
              <datalist id="fq-label-suggestions">
                {FREIGHT_LINE_SUGGESTIONS.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
              <div>
                <button type="button" className="btn btn-line btn-sm" disabled={fqLines.length >= FREIGHT_MAX_LINES} onClick={() => setFqLines((prev) => [...prev, { label: '', amount: '' }])}>
                  <Icon name="plus" size={14} /> {t('Tambah baris', 'Add line')}
                </button>
              </div>
              <div className="fq-editor-total">
                <span>
                  Total <small>({fqLines.length} {t('baris', fqLines.length === 1 ? 'line' : 'lines')})</small>
                </span>
                <span className="mono">{formatIDR(fqTotal)}</span>
              </div>
              {(fqErrors.total || fqErrors.lines) && <small className="admin-form-error">{fqErrors.total || fqErrors.lines}</small>}
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Berlaku sampai', 'Valid until')}</span>
                <input type="date" min={todayIso()} value={fqValidUntil} onChange={(e) => setFqValidUntil(e.target.value)} />
                <small className="admin-field-hint">
                  {t(`Sampai akhir hari itu. Kosong = hari ini + ${freightValidDays ?? DEFAULT_FREIGHT_VALID_DAYS} hari (pengaturan checkout).`, `Until the end of that day. Empty = today + ${freightValidDays ?? DEFAULT_FREIGHT_VALID_DAYS} days (checkout settings).`)}
                </small>
                {fqErrors.validUntil && <small className="admin-form-error">{fqErrors.validUntil}</small>}
              </label>
            </div>
            <label>
              <span className="field-label">{t('Catatan', 'Notes')}</span>
              <textarea rows={3} maxLength={1000} value={fqNote} onChange={(e) => setFqNote(e.target.value)} placeholder={t('Tampil di kartu penawaran customer, mis. pelayaran, jenis kontainer, perkiraan transit (opsional).', 'Shown on the customer quote card, e.g. carrier, container type, transit estimate (optional).')} />
              {fqErrors.note && <small className="admin-form-error">{fqErrors.note}</small>}
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Mengirim...', 'Sending...') : t('Kirim penawaran', 'Send quote')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'freightExtend' && (
        <AdminModal title={t('Perpanjang masa berlaku penawaran', 'Extend quote validity')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitExtend}>
            <p className="admin-field-hint">
              {t('Putaran', 'Round')} {modal.quote.round} · {formatIDR(modal.quote.total)}
              {modal.quote.validUntil ? ` · ${t('berlaku sampai', 'valid until')} ${formatDateTime(modal.quote.validUntil, lang)}` : ''}.{' '}
              {t('Customer bisa menyetujui penawaran lagi sampai tanggal baru dan akan menerima email serta notifikasi.', 'The customer can accept the quote again until the new date and is emailed and notified.')}
            </p>
            <label>
              <span className="field-label">{t('Berlaku sampai', 'Valid until')}</span>
              <input type="date" min={todayIso()} value={fqValidUntil} onChange={(e) => setFqValidUntil(e.target.value)} required />
              {fqErrors.validUntil && <small className="admin-form-error">{fqErrors.validUntil}</small>}
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Menyimpan...', 'Saving...') : t('Perpanjang', 'Extend')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
