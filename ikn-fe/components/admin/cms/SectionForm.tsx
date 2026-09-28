'use client';

import { useState, type FormEvent } from 'react';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { tr, type FieldDef, type PageSection, type SectionContent, type SectionTypeDef } from '@/lib/cms';
import type { Lang } from '@/lib/types';
import FieldInput from './FieldInput';
import I18nInput from './I18nInput';
import I18nRichTextEditor from './I18nRichTextEditor';
import ListField from './ListField';
import MediaPicker from './MediaPicker';
import {
  firstError,
  hasErrorUnder,
  normalizeContent,
  toI18n,
  toMediaRef,
  toPayload,
  type FieldErrors,
} from './schema';

// Renders one schema field (recursively for lists) bound to a dotted error path.
interface FieldRendererProps {
  fieldKey: string;
  def: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  path: string;
  errors: FieldErrors;
  icons: string[];
  lang: Lang;
}

export function FieldRenderer({ fieldKey, def, value, onChange, path, errors, icons, lang }: FieldRendererProps) {
  const label = tr(def.name, lang) || fieldKey;

  switch (def.type) {
    case 'i18n_richtext':
      return (
        <I18nRichTextEditor
          label={label}
          value={toI18n(value)}
          onChange={onChange}
          required={def.required}
          collection="general"
          minHeight={220}
          errorId={firstError(errors, `${path}.id`, path)}
          errorEn={firstError(errors, `${path}.en`)}
        />
      );
    case 'i18n_text':
    case 'i18n_textarea':
      return (
        <I18nInput
          label={label}
          value={toI18n(value)}
          onChange={onChange}
          multiline={def.type === 'i18n_textarea'}
          rows={3}
          required={def.required}
          maxLength={def.max}
          errorId={firstError(errors, `${path}.id`, path)}
          errorEn={firstError(errors, `${path}.en`)}
        />
      );
    case 'media':
      return (
        <MediaPicker
          label={label}
          value={toMediaRef(value)}
          onChange={onChange}
          accept={def.accept ?? 'image'}
          collection={def.accept === 'document' ? 'documents' : 'general'}
          required={def.required}
          error={firstError(errors, path)}
        />
      );
    case 'list': {
      const subFields = def.fields ?? {};
      const items = Array.isArray(value) ? (value as SectionContent[]) : [];
      return (
        <ListField<SectionContent>
          label={label}
          items={items}
          onChange={onChange}
          createItem={() => normalizeContent(subFields, {})}
          maxItems={def.max_items}
          required={def.required}
          error={firstError(errors, path)}
          itemHasError={(index) => hasErrorUnder(errors, `${path}.${index}`)}
          addLabel={lang === 'en' ? 'Add item' : 'Tambah item'}
          renderItem={(item, index, update) => (
            <div className="cms-fields">
              {Object.entries(subFields).map(([subKey, subDef]) => (
                <FieldRenderer
                  key={subKey}
                  fieldKey={subKey}
                  def={subDef}
                  value={item[subKey]}
                  onChange={(next) => update({ ...item, [subKey]: next })}
                  path={`${path}.${index}.${subKey}`}
                  errors={errors}
                  icons={icons}
                  lang={lang}
                />
              ))}
            </div>
          )}
        />
      );
    }
    default:
      return (
        <FieldInput
          label={label}
          def={def}
          value={value}
          onChange={onChange}
          icons={icons}
          error={firstError(errors, path)}
        />
      );
  }
}

// Schema-driven editor for one section. Existing section → PUT /admin/sections/{id};
// new section → POST /admin/pages/{pageId}/sections. 422 errors map onto the inputs.
interface SectionFormProps {
  section?: PageSection | null;
  pageId?: number;
  type: string;
  def: SectionTypeDef;
  icons: string[];
  onSaved: (section: PageSection) => void;
  onCancel: () => void;
}

export default function SectionForm({ section, pageId, type, def, icons, onSaved, onCancel }: SectionFormProps) {
  const { lang } = useLang();
  const [content, setContent] = useState<SectionContent>(() => normalizeContent(def.fields, section?.content));
  const [key, setKey] = useState(section?.key ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const t = (idText: string, en: string) => (lang === 'en' ? en : idText);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setErrors({});
    const payload = toPayload(def.fields, content);
    const cleanKey = key.trim() || null;
    try {
      const saved = section
        ? await api<PageSection>(`/admin/sections/${section.id}`, {
            method: 'PUT',
            body: { content: payload, key: cleanKey },
          })
        : await api<PageSection>(`/admin/pages/${pageId}/sections`, {
            method: 'POST',
            body: { type, content: payload, key: cleanKey },
          });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(err.errors);
        setError(err.message || t('Periksa kembali isian yang ditandai.', 'Please check the highlighted fields.'));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={(event) => void submit(event)}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="admin-field-hint">{tr(def.description, lang)}</p>
      <div className="cms-fields">
        {Object.entries(def.fields).map(([fieldKey, fieldDef]) => (
          <FieldRenderer
            key={fieldKey}
            fieldKey={fieldKey}
            def={fieldDef}
            value={content[fieldKey]}
            onChange={(next) => setContent((current) => ({ ...current, [fieldKey]: next }))}
            path={`content.${fieldKey}`}
            errors={errors}
            icons={icons}
            lang={lang}
          />
        ))}
      </div>
      <details className="cms-advanced">
        <summary>{t('Lanjutan', 'Advanced')}</summary>
        <label>
          <span className="field-label">{t('Kunci section (key)', 'Section key')}</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="opsional, mis. hero" maxLength={64} />
          <small className="admin-field-hint">
            {t(
              'Dipakai situs untuk merujuk section tertentu. Biarkan bila tidak yakin.',
              'Used by the site to reference a specific section. Leave as is if unsure.',
            )}
          </small>
          {errors.key?.[0] && <small className="cms-field-error">{errors.key[0]}</small>}
        </label>
      </details>
      <div className="admin-modal-actions">
        <button type="button" className="btn btn-line btn-sm" onClick={onCancel}>
          {t('Batal', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
          {saving
            ? t('Menyimpan...', 'Saving...')
            : section
              ? t('Simpan isi', 'Save content')
              : t('Tambah section', 'Add section')}
        </button>
      </div>
    </form>
  );
}
