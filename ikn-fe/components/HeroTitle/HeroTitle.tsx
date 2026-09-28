// Judul hero (baris-baris dari CMS). Baris kedua diberi aksen (italic hijau).
export default function HeroTitle({ lines }: { lines: string[] }) {
  return (
    <h1 className="display hero-title">
      {lines.map((line, i) => (
        <span key={i}>
          {i === 1 ? <span className="hero-title-em">{line}</span> : line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </h1>
  );
}
