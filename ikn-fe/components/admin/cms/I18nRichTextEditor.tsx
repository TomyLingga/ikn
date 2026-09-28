'use client';

import { useId, useState } from 'react';
import { useLang } from '@/components/LanguageProvider';
import type { I18n } from '@/lib/cms';
import RichTextEditor from './RichTextEditor';

// Bilingual rich text: one ID tab and one EN tab over two editor instances.
// The inactive editor is hidden with CSS (not unmounted) so each keeps its
// undo history and scroll position while the admin switches languages.
interface I18nRichTextEditorProps {
  label: string;
  value: I18n;
  onChange: (next: I18n) => void;
  required?: boolean;
  errorId?: string;
  errorEn?: string;
  hint?: string;
  placeholder?: string;
  collection?: string;
  minHeight?: number;
}

type EditorLang = 'id' | 'en';

export default function I18nRichTextEditor({
  label,
  value,
  onChange,
  required = false,
  errorId,
  errorEn,
  hint,
  placeholder,
  collection = 'news',
  minHeight,
}: I18nRichTextEditorProps) {
  const { lang } = useLang();
  const t = (idText: string, en: string) => (lang === 'en' ? en : idText);
  const [active, setActive] = useState<EditorLang>('id');
  const baseId = useId();

  const tabs: Array<{ code: EditorLang; label: string; error?: string }> = [
    { code: 'id', label: 'ID', error: errorId },
    { code: 'en', label: 'EN', error: errorEn },
  ];

  return (
    <div className="cms-field">
      <span className="field-label">
        {label}
        {required && <span className="cms-req">*</span>}
      </span>
      <div className="rte-lang-tabs" role="tablist" aria-label={t('Bahasa isi', 'Content language')}>
        {tabs.map((tab) => (
          <button
            key={tab.code}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.code}`}
            aria-selected={active === tab.code}
            aria-controls={`${baseId}-pane-${tab.code}`}
            className={`rte-lang-tab${active === tab.code ? ' is-active' : ''}${tab.error ? ' has-error' : ''}`}
            onClick={() => setActive(tab.code)}
          >
            {tab.label}
            {tab.error && <span className="rte-lang-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.code}
          role="tabpanel"
          id={`${baseId}-pane-${tab.code}`}
          aria-labelledby={`${baseId}-tab-${tab.code}`}
          className="rte-lang-pane"
          hidden={active !== tab.code}
        >
          <RichTextEditor
            value={value[tab.code] ?? ''}
            onChange={(html) => onChange({ ...value, [tab.code]: html })}
            placeholder={tab.code === 'en' ? 'kosong = ikuti ID' : placeholder}
            collection={collection}
            minHeight={minHeight}
            id={`${baseId}-${tab.code}`}
            invalid={!!tab.error}
          />
          {tab.error && <small className="cms-field-error">{tab.error}</small>}
        </div>
      ))}
      {hint && <small className="admin-field-hint">{hint}</small>}
    </div>
  );
}
