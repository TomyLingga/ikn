// Angka → kata dalam Bahasa Indonesia untuk baris "Terbilang" pada invoice (rupiah bulat).
const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

function below1000(n: number): string {
  if (n < 12) return SATUAN[n] ?? '';
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rest = n % 10;
    return `${SATUAN[tens]} Puluh${rest ? ` ${SATUAN[rest]}` : ''}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return `${hundreds === 1 ? 'Seratus' : `${SATUAN[hundreds]} Ratus`}${rest ? ` ${below1000(rest)}` : ''}`;
}

/** terbilang(25993980) → "Dua Puluh Lima Juta Sembilan Ratus Sembilan Puluh Tiga Ribu Sembilan Ratus Delapan Puluh". */
export function terbilang(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Nol';
  const scales: [number, string][] = [
    [1_000_000_000_000, 'Triliun'],
    [1_000_000_000, 'Miliar'],
    [1_000_000, 'Juta'],
    [1_000, 'Ribu'],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [size, name] of scales) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(count === 1 && size === 1_000 ? 'Seribu' : `${below1000(count)} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(' ');
}

export function terbilangRupiah(value: number): string {
  return `${terbilang(value)} Rupiah`;
}
