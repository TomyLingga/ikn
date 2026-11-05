// Tema warna Navy · Cream · Coral (ASUMSI A-91, 2026-11-05): satu set warna per mode dari Pengaturan Situs
// (settings.theme, hex #rrggbb), disuntik sebagai --tl-* (terang) dan --td-* (gelap) di <html> oleh app/layout.tsx.
// globals.css memetakan set mode aktif ke --tm-* lalu menurunkan semua token lain (--paper, --ink, --primary, dst.).
// Nilai bawaan di sini HARUS sama dengan globals.css dan SettingsService.

export interface ThemeSettings {
  light_base: string; // terang: latar dominan
  light_ink: string; // terang: teks, pita, tombol
  light_accent: string; // terang: sorotan kecil, ikon
  light_soft: string; // terang: latar section berfoto
  dark_base: string; // gelap: latar dominan
  dark_ink: string; // gelap: teks, tombol
  dark_accent: string; // gelap: sorotan kecil, ikon
  dark_deep: string; // gelap: latar terdalam (panel admin, pita)
}

export const THEME_DEFAULTS: ThemeSettings = {
  light_base: '#f4ede0',
  light_ink: '#102d50',
  light_accent: '#ff6b5b',
  light_soft: '#dceaf7',
  dark_base: '#102d50',
  dark_ink: '#f4ede0',
  dark_accent: '#ff6b5b',
  dark_deep: '#0b1220',
};

export const THEME_VARIABLES: Record<keyof ThemeSettings, string> = {
  light_base: '--tl-base',
  light_ink: '--tl-ink',
  light_accent: '--tl-accent',
  light_soft: '--tl-soft',
  dark_base: '--td-base',
  dark_ink: '--td-ink',
  dark_accent: '--td-accent',
  dark_deep: '--td-deep',
};

export const THEME_KEYS = Object.keys(THEME_VARIABLES) as (keyof ThemeSettings)[];

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Nilai efektif sebuah warna tema (hex valid dari pengaturan, selain itu bawaan). */
export function themeColor(theme: Partial<ThemeSettings> | null | undefined, key: keyof ThemeSettings): string {
  const value = (theme?.[key] || '').trim().toLowerCase();
  return HEX_COLOR.test(value) ? value : THEME_DEFAULTS[key];
}

/**
 * CSS untuk <style> di <head>. Hanya hex valid yang disuntik (nilai dari DB tidak pernah dipercaya mentah), dan
 * hanya bila berbeda dari bawaan. Selector `html:root` mengalahkan `:root` di globals.css apa pun urutan stylesheet;
 * kedua set (terang & gelap) ada di elemen yang sama, mode aktif dipilih globals.css lewat [data-theme].
 */
export function themeStyle(theme: Partial<ThemeSettings> | null | undefined): string {
  const declarations: string[] = [];
  for (const key of THEME_KEYS) {
    const value = themeColor(theme, key);
    if (value !== THEME_DEFAULTS[key]) declarations.push(`${THEME_VARIABLES[key]}:${value}`);
  }
  return declarations.length ? `html:root{${declarations.join(';')}}` : '';
}
