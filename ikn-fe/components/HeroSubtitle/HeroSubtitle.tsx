// Subjudul hero (teks sudah dipilih bahasanya oleh pemanggil).
export default function HeroSubtitle({ text }: { text: string }) {
  if (!text) return null;
  return <p className="lead">{text}</p>;
}
