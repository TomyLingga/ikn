// Tema warna situs: nilai dari Pengaturan Situs (settings.theme, hex #rrggbb) disuntik sebagai custom property
// --theme-* di <html> oleh app/layout.tsx. globals.css menurunkan --primary/--accent (+ varian tint/soft/dark) dari
// token itu, dan alias lama --green/--amber menunjuk ke sana. Nilai bawaan di sini HARUS sama dengan globals.css.

export interface ThemeSettings {
  primary: string; // tombol, tautan, label, ikon aktif
  primary_deep: string; // footer dan blok latar gelap
  accent: string; // nomor bagian, badge promo, sorotan kecil
}

export const THEME_DEFAULTS: ThemeSettings = {
  primary: '#0b6fb8',
  primary_deep: '#0a3f6b',
  accent: '#1785cc',
};

export const THEME_VARIABLES: Record<keyof ThemeSettings, string> = {
  primary: '--theme-primary',
  primary_deep: '--theme-primary-deep',
  accent: '--theme-accent',
};

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Nilai efektif sebuah warna tema (hex valid dari pengaturan, selain itu bawaan). */
export function themeColor(theme: Partial<ThemeSettings> | null | undefined, key: keyof ThemeSettings): string {
  const value = (theme?.[key] || '').trim().toLowerCase();
  return HEX_COLOR.test(value) ? value : THEME_DEFAULTS[key];
}

/**
 * CSS untuk <style> di <head>. Hanya hex valid yang disuntik (nilai dari DB tidak pernah dipercaya mentah), dan
 * hanya bila berbeda dari bawaan. Selector `html:root` mengalahkan `:root` di globals.css apa pun urutan stylesheet.
 */
export function themeStyle(theme: Partial<ThemeSettings> | null | undefined): string {
  const declarations: string[] = [];
  for (const key of Object.keys(THEME_VARIABLES) as (keyof ThemeSettings)[]) {
    const value = themeColor(theme, key);
    if (value !== THEME_DEFAULTS[key]) declarations.push(`${THEME_VARIABLES[key]}:${value}`);
  }
  return declarations.length ? `html:root{${declarations.join(';')}}` : '';
}
