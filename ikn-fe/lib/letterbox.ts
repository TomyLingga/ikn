// Deteksi pita hitam (letterbox) yang "terbakar" di dalam thumbnail (mis. video sinematik 2,39:1 di YouTube) dan
// hitung faktor zoom agar pita itu terpotong saat gambar ditampilkan dengan object-fit: cover di bingkai 16:9.
// Hasil 1 = tidak perlu zoom. Membutuhkan gambar dengan CORS (i.ytimg.com mengizinkan); bila kanvas tercemar
// atau gambar gagal dimuat, kembalikan 1 tanpa galat. Hasil di-cache per URL.
const cache = new Map<string, Promise<number>>();

export function letterboxZoom(src: string, frameAspect = 16 / 9): Promise<number> {
  if (typeof window === 'undefined' || !src) return Promise.resolve(1);
  const key = `${src}@${frameAspect}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = new Promise<number>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(measure(img, frameAspect));
      img.onerror = () => resolve(1);
      img.src = src;
    });
    cache.set(key, pending);
  }
  return pending;
}

function measure(img: HTMLImageElement, frameAspect: number): number {
  try {
    const W = 48;
    const H = 48;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !img.naturalWidth || !img.naturalHeight) return 1;
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const rowMean = (y: number) => {
      let sum = 0;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        sum += (data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114;
      }
      return sum / W;
    };
    const DARK = 22;
    let top = 0;
    while (top < H / 2 && rowMean(top) < DARK) top++;
    let bottom = 0;
    while (bottom < H / 2 && rowMean(H - 1 - bottom) < DARK) bottom++;
    if (top === 0 && bottom === 0) return 1;
    if (top + bottom >= H * 0.45 || Math.abs(top - bottom) > 2) return 1; // gambar gelap, bukan pita simetris

    // object-fit: cover sudah memotong selisih rasio gambar vs bingkai; hitung sisa pita yang masih terlihat.
    const aspect = img.naturalWidth / img.naturalHeight;
    const visible = Math.min(1, aspect / frameAspect); // bagian tinggi gambar yang tampil di bingkai
    const cropPerSide = (1 - visible) / 2;
    const remain = Math.max(0, top / H - cropPerSide) + Math.max(0, bottom / H - cropPerSide);
    if (remain <= 0.01) return 1;
    return Math.min(1.6, visible / (visible - remain));
  } catch {
    return 1;
  }
}
