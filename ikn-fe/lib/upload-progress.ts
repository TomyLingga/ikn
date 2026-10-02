// Status unggahan yang sedang berjalan (dipakai lib/api.ts untuk setiap request multipart, ditampilkan oleh
// components/UploadProgress di root layout: dialog berpersentase, keadaan galat, tombol batal).

export type UploadStatus = 'uploading' | 'processing' | 'done' | 'error';

export interface UploadItem {
  id: number;
  name: string;
  loaded: number;
  total: number;
  status: UploadStatus;
  message?: string;
  cancel?: () => void;
}

type Listener = (items: UploadItem[]) => void;

let items: UploadItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  const snapshot = items.map((item) => ({ ...item }));
  listeners.forEach((listener) => listener(snapshot));
}

function patch(id: number, changes: Partial<UploadItem>) {
  items = items.map((item) => (item.id === id ? { ...item, ...changes } : item));
  emit();
}

export function subscribeUploads(listener: Listener): () => void {
  listeners.add(listener);
  listener(items.map((item) => ({ ...item })));
  return () => listeners.delete(listener);
}

export function dismissUpload(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export interface UploadTracker {
  progress: (loaded: number, total: number) => void;
  processing: () => void;
  done: () => void;
  fail: (message: string) => void;
  setCancel: (cancel: () => void) => void;
}

/** Daftarkan unggahan baru; selesai = hilang otomatis sebentar kemudian, galat = tetap tampil sampai ditutup. */
export function trackUpload(name: string, total: number): UploadTracker {
  const id = nextId++;
  items = [...items, { id, name, loaded: 0, total, status: 'uploading' }];
  emit();
  return {
    progress: (loaded, totalBytes) => patch(id, { loaded, total: totalBytes || total }),
    processing: () => patch(id, { status: 'processing', cancel: undefined }),
    done: () => {
      patch(id, { status: 'done', loaded: total, cancel: undefined });
      window.setTimeout(() => dismissUpload(id), 700);
    },
    fail: (message) => patch(id, { status: 'error', message, cancel: undefined }),
    setCancel: (cancel) => patch(id, { cancel }),
  };
}

// ---------------------------------------------------------------- Batas ukuran (cermin config ikn-api)

const MB = 1024 * 1024;

/** Batas per berkas, sama dengan ikn-api config/ikn.php (media, commerce, wbs). */
export const UPLOAD_LIMITS = {
  imageMb: 5,
  documentMb: 10,
  videoMb: 100,
  proofMb: 5,
  attachmentMb: 10,
  wbsMb: 10,
};

function kindOf(file: File): 'image' | 'video' | 'document' {
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name)) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return 'document';
}

/** Batas (MB) untuk berkas ini pada endpoint ini. */
export function uploadLimitMb(path: string, file: File): number {
  const p = path.split('?')[0] || '';
  if (/\/proof$/.test(p)) return UPLOAD_LIMITS.proofMb;
  if (/\/attachments$/.test(p)) return UPLOAD_LIMITS.attachmentMb;
  if (/^\/(admin\/)?wbs/.test(p) || p.startsWith('/admin/help-guide')) return UPLOAD_LIMITS.wbsMb;
  const kind = kindOf(file);
  return kind === 'video' ? UPLOAD_LIMITS.videoMb : kind === 'image' ? UPLOAD_LIMITS.imageMb : UPLOAD_LIMITS.documentMb;
}

export function formatMb(bytes: number): string {
  return `${(bytes / MB).toLocaleString('id-ID', { maximumFractionDigits: bytes < 10 * MB ? 1 : 0 })} MB`;
}

/** Pesan bila ada berkas yang melebihi batas, atau null bila semua aman. */
export function oversizeMessage(path: string, form: FormData, lang: 'id' | 'en'): string | null {
  for (const value of Array.from(form.values())) {
    if (!(value instanceof File) || !value.size) continue;
    const limit = uploadLimitMb(path, value);
    if (value.size > limit * MB) {
      const kind = kindOf(value);
      const what = lang === 'en' ? { video: 'videos', image: 'images', document: 'documents' }[kind] : { video: 'video', image: 'gambar', document: 'dokumen' }[kind];
      return lang === 'en'
        ? `"${value.name}" is ${formatMb(value.size)}, over the ${limit} MB limit for ${what}. Compress it or pick a smaller file.`
        : `Berkas "${value.name}" berukuran ${formatMb(value.size)}, melebihi batas ${limit} MB untuk ${what}. Kompres atau pilih berkas yang lebih kecil.`;
    }
  }
  return null;
}

/** Nama yang ditampilkan di dialog: berkas pertama di form. */
export function uploadName(form: FormData): { name: string; size: number } {
  const files = Array.from(form.values()).filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) return { name: '', size: 0 };
  return { name: files.length > 1 ? `${files[0]!.name} +${files.length - 1}` : files[0]!.name, size: files.reduce((n, f) => n + f.size, 0) };
}
