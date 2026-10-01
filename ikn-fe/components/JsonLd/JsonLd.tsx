// Data terstruktur schema.org untuk mesin pencari (dirender di server sebagai <script type="application/ld+json">).
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // "<" di-escape agar isi JSON tidak bisa menutup tag script.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
