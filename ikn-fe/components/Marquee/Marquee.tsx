import styles from './Marquee.module.css';

// Teks berjalan di bawah hero. Kata-kata berasal dari CMS (section marquee).
export default function Marquee({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  // Digandakan agar loop mulus.
  const loop = [...items, ...items];
  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.track}>
        {loop.map((word, i) => (
          <span key={i} className={styles.item}>
            {word}
            <span className={styles.dot}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
