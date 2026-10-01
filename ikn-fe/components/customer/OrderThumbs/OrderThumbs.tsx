import Image from 'next/image';
import Icon from '@/components/Icon';
import styles from './OrderThumbs.module.css';

interface ThumbItem {
  productSlug?: string;
  image?: string | null;
}

interface OrderThumbsProps {
  items: ThumbItem[];
  size?: number;
  /** Jumlah foto yang ditampilkan; sisanya diringkas sebagai "+n". */
  max?: number;
}

// Foto produk kecil untuk baris pesanan (snapshot `image` saat checkout); tanpa foto → ikon paket.
export default function OrderThumbs({ items, size = 56, max = 3 }: OrderThumbsProps) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;

  return (
    <span className={styles.thumbs} style={{ height: size }}>
      {(shown.length ? shown : [{}]).map((item, index) => (
        <span key={`${item.productSlug || 'x'}-${index}`} className={styles.thumb} style={{ width: size, height: size }}>
          {item.image ? <Image src={item.image} alt="" width={size} height={size} /> : <Icon name="package" size={Math.round(size * 0.42)} strokeWidth={1.5} />}
        </span>
      ))}
      {rest > 0 && (
        <span className={`${styles.thumb} ${styles.more}`} style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
