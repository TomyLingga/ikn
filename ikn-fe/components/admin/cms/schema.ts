// Helpers for schema-driven section forms (GET /admin/cms/section-types).
// Content state keeps hydrated media objects for previews; toPayload() turns
// them back into ids before sending to the API.

import type { FieldDef, I18n, MediaSummary, SectionContent } from '@/lib/cms';
import { emptyI18n } from '@/lib/cms';

export type MediaRef = MediaSummary | { id: number };
export type MediaValue = MediaRef | number | null | undefined;
export type FieldErrors = Record<string, string[]>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toI18n(value: unknown): I18n {
  if (isRecord(value)) return { id: String(value.id ?? ''), en: String(value.en ?? '') };
  if (typeof value === 'string') return { id: value, en: '' };
  return emptyI18n();
}

export function toMediaRef(value: unknown): MediaRef | null {
  if (typeof value === 'number' && value > 0) return { id: value };
  if (isRecord(value) && typeof value.id === 'number' && value.id > 0) {
    return typeof value.url === 'string' ? (value as unknown as MediaSummary) : { id: value.id };
  }
  return null;
}

export function mediaId(value: unknown): number | null {
  return toMediaRef(value)?.id ?? null;
}

export function mediaSummary(value: unknown): MediaSummary | null {
  const ref = toMediaRef(value);
  return ref && 'url' in ref ? ref : null;
}

/** Empty value for a field so every input stays controlled. */
export function defaultValue(def: FieldDef): unknown {
  switch (def.type) {
    case 'i18n_text':
    case 'i18n_textarea':
    case 'i18n_richtext':
      return emptyI18n();
    case 'list':
      return [];
    case 'boolean':
      return false;
    case 'number':
      return null;
    case 'media':
      return null;
    case 'select':
      return def.default ?? Object.keys(def.options ?? {})[0] ?? '';
    default:
      return def.default ?? '';
  }
}

function normalizeValue(def: FieldDef, value: unknown): unknown {
  switch (def.type) {
    case 'i18n_text':
    case 'i18n_textarea':
    case 'i18n_richtext':
      return toI18n(value);
    case 'list':
      return Array.isArray(value) ? value.map((item) => normalizeContent(def.fields ?? {}, item)) : [];
    case 'boolean':
      return value === true || value === 'true' || value === 1 || value === '1';
    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
      return null;
    }
    case 'media':
      return toMediaRef(value);
    default:
      return value == null ? defaultValue(def) : String(value);
  }
}

/** Fill content so that every schema key exists with the right shape. */
export function normalizeContent(fields: Record<string, FieldDef>, content: unknown): SectionContent {
  const source = isRecord(content) ? content : {};
  const out: SectionContent = {};
  for (const [key, def] of Object.entries(fields)) {
    out[key] = normalizeValue(def, source[key]);
  }
  return out;
}

/** API payload: media refs become ids, lists recurse. */
export function toPayload(fields: Record<string, FieldDef>, content: SectionContent): SectionContent {
  const out: SectionContent = {};
  for (const [key, def] of Object.entries(fields)) {
    const value: unknown = content[key];
    if (def.type === 'media') {
      out[key] = mediaId(value);
    } else if (def.type === 'list') {
      out[key] = Array.isArray(value)
        ? value.map((item) => toPayload(def.fields ?? {}, isRecord(item) ? item : {}))
        : [];
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** First validation message found under any of the given dotted paths. */
export function firstError(errors: FieldErrors, ...paths: string[]): string | undefined {
  for (const path of paths) {
    const message = errors[path]?.[0];
    if (message) return message;
  }
  return undefined;
}

/** True when any error key sits under the prefix (e.g. "content.items.0"). */
export function hasErrorUnder(errors: FieldErrors, prefix: string): boolean {
  return Object.keys(errors).some((key) => key === prefix || key.startsWith(prefix + '.'));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
}
