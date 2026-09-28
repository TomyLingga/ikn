'use client';

import type { I18n } from '@/lib/cms';

// Bilingual input: ID and EN side by side. EN is optional (server falls back to ID).
interface I18nInputProps {
  label: string;
  value: I18n;
  onChange: (next: I18n) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  maxLength?: number;
  errorId?: string;
  errorEn?: string;
  hint?: string;
  placeholder?: string;
}

export default function I18nInput({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  required = false,
  maxLength,
  errorId,
  errorEn,
  hint,
  placeholder,
}: I18nInputProps) {
  function column(lang: 'id' | 'en') {
    const text = value[lang] ?? '';
    const ph = lang === 'en' ? 'kosong = ikuti ID' : placeholder;
    const error = lang === 'en' ? errorEn : errorId;
    return (
      <label className="cms-i18n-col">
        <span className="cms-lang-tag">{lang.toUpperCase()}</span>
        {multiline ? (
          <textarea
            rows={rows}
            value={text}
            maxLength={maxLength}
            placeholder={ph}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
          />
        ) : (
          <input
            type="text"
            value={text}
            maxLength={maxLength}
            placeholder={ph}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
          />
        )}
        {error && <small className="cms-field-error">{error}</small>}
      </label>
    );
  }

  return (
    <div className="cms-field">
      <span className="field-label">
        {label}
        {required && <span className="cms-req">*</span>}
      </span>
      <div className="cms-i18n">
        {column('id')}
        {column('en')}
      </div>
      {hint && <small className="admin-field-hint">{hint}</small>}
    </div>
  );
}
