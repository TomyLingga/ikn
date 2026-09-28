'use client';

import Icon from '@/components/Icon';
import { emptyI18n, isPrimaryMenuItem, type MenuNode } from '@/lib/cms';
import type { Lang } from '@/lib/types';
import I18nInput from './I18nInput';
import { firstError, type FieldErrors } from './schema';

export function emptyMenuNode(): MenuNode {
  return { key: null, label: emptyI18n(), description: null, url: '', isActive: true, children: [] };
}

/** Body for PUT /admin/menus/{location}: strips ids, limits depth to two levels. */
export function menuPayload(items: MenuNode[], withChildren: boolean): unknown[] {
  return items.map((item) => ({
    key: item.key?.trim() || null,
    label: item.label,
    description: item.description && (item.description.id || item.description.en) ? item.description : null,
    url: item.url?.trim() || null,
    isActive: item.isActive,
    children: withChildren ? menuPayload(item.children, false) : [],
  }));
}

function moveIn<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return list;
  next.splice(to, 0, moved);
  return next;
}

interface RowToolsProps {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  lockedTitle?: string; // diisi = item bawaan, tidak bisa dihapus
}

function RowTools({ index, count, onMove, onRemove, lockedTitle }: RowToolsProps) {
  return (
    <div className="cms-list-item-tools">
      <button type="button" className="row-act" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Naik">
        <Icon name="arrowDown" size={13} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <button
        type="button"
        className="row-act"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
        aria-label="Turun"
      >
        <Icon name="arrowDown" size={13} />
      </button>
      <button
        type="button"
        className="row-act row-act-danger"
        onClick={onRemove}
        aria-label="Hapus"
        disabled={!!lockedTitle}
        title={lockedTitle}
      >
        ✕
      </button>
    </div>
  );
}

interface MenuNodeFieldsProps {
  node: MenuNode;
  onChange: (next: MenuNode) => void;
  errors: FieldErrors;
  path: string;
  lang: Lang;
  locked?: boolean; // item bawaan: key tidak bisa diubah
}

function MenuNodeFields({ node, onChange, errors, path, lang, locked = false }: MenuNodeFieldsProps) {
  const t = (idText: string, en: string) => (lang === 'en' ? en : idText);
  return (
    <div className="cms-fields">
      <I18nInput
        label="Label"
        value={node.label}
        onChange={(label) => onChange({ ...node, label })}
        required
        maxLength={120}
        errorId={firstError(errors, `${path}.label.id`, `${path}.label`)}
        errorEn={firstError(errors, `${path}.label.en`)}
      />
      <I18nInput
        label={t('Deskripsi singkat', 'Short description')}
        value={node.description ?? emptyI18n()}
        onChange={(description) => onChange({ ...node, description })}
        maxLength={200}
        errorId={firstError(errors, `${path}.description.id`)}
        errorEn={firstError(errors, `${path}.description.en`)}
      />
      <div className="admin-form-row">
        <label>
          <span className="field-label">URL</span>
          <input
            value={node.url ?? ''}
            onChange={(e) => onChange({ ...node, url: e.target.value })}
            placeholder="/tentang atau https://..."
            maxLength={500}
          />
          {firstError(errors, `${path}.url`) && <small className="cms-field-error">{firstError(errors, `${path}.url`)}</small>}
        </label>
        <label>
          <span className="field-label">{t('Kunci (key)', 'Key')}</span>
          <input
            value={node.key ?? ''}
            onChange={(e) => onChange({ ...node, key: e.target.value || null })}
            placeholder="mis. tentang"
            maxLength={64}
            readOnly={locked}
          />
          <small className="admin-field-hint">
            {locked
              ? t('Kunci menu bawaan, tidak dapat diubah.', 'Built-in menu key, cannot be changed.')
              : t('Dipakai sebagai kategori tautan dokumen.', 'Used as a document-link category.')}
          </small>
          {firstError(errors, `${path}.key`) && <small className="cms-field-error">{firstError(errors, `${path}.key`)}</small>}
        </label>
      </div>
      <label className="cms-check">
        <input type="checkbox" checked={node.isActive} onChange={(e) => onChange({ ...node, isActive: e.target.checked })} />
        <span>{t('Aktif (tampil di situs)', 'Active (shown on site)')}</span>
      </label>
    </div>
  );
}

// Two-level menu tree editor (header) or flat list editor (footer).
interface MenuEditorProps {
  items: MenuNode[];
  onChange: (items: MenuNode[]) => void;
  allowChildren?: boolean;
  errors?: FieldErrors;
  lang: Lang;
}

export default function MenuEditor({ items, onChange, allowChildren = true, errors = {}, lang }: MenuEditorProps) {
  const t = (idText: string, en: string) => (lang === 'en' ? en : idText);

  function update(index: number, next: MenuNode) {
    onChange(items.map((item, i) => (i === index ? next : item)));
  }

  const lockedTitle = t('Menu bawaan, selalu di baris pertama bilah atas dan tidak dapat dihapus', 'Built-in menu, always on the first row of the top bar and cannot be removed');

  return (
    <div className="menu-editor">
      {allowChildren && (
        <p className="cms-hint">
          {t(
            'Bilah atas situs memuat maksimal 6 menu utama per baris. Enam menu bawaan (Beranda sampai Kontak) dikunci di baris pertama; menu utama ke-7 dan seterusnya turun ke baris kedua tepat di bawah Beranda, Tentang Kami, dan seterusnya. Alternatif yang lebih ringkas: jadikan halaman baru sebagai sub-menu dari menu yang sudah ada.',
            'The site top bar shows at most 6 top-level menus per row. The six built-in menus (Home to Contact) are locked to the first row; the 7th menu onward wraps to a second row right under Home, About, and so on. A more compact alternative: add new pages as sub-menus of an existing menu.',
          )}
        </p>
      )}
      {items.length === 0 && <p className="admin-field-hint">{t('Belum ada item menu.', 'No menu items yet.')}</p>}
      {items.map((item, index) => {
        const locked = allowChildren && isPrimaryMenuItem(item);
        return (
        <div key={index} className="menu-item">
          <div className="menu-item-head">
            <span className="mono">#{index + 1}</span>
            <strong>{item.label.id || t('(tanpa label)', '(no label)')}</strong>
            {locked && <span className="cms-badge">{t('Bawaan · baris 1', 'Built-in · row 1')}</span>}
            <RowTools
              index={index}
              count={items.length}
              onMove={(to) => onChange(moveIn(items, index, to))}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
              lockedTitle={locked ? lockedTitle : undefined}
            />
          </div>
          <MenuNodeFields node={item} onChange={(next) => update(index, next)} errors={errors} path={`items.${index}`} lang={lang} locked={locked} />
          {allowChildren && (
            <div className="menu-children">
              <div className="menu-children-head">
                <span className="field-label">{t('Sub-menu', 'Sub-menu')}</span>
                <button
                  type="button"
                  className="row-act"
                  disabled={item.children.length >= 20}
                  onClick={() => update(index, { ...item, children: [...item.children, emptyMenuNode()] })}
                >
                  + {t('Tambah sub-menu', 'Add sub-menu')}
                </button>
              </div>
              {item.children.map((child, childIndex) => (
                <div key={childIndex} className="menu-item menu-item-child">
                  <div className="menu-item-head">
                    <span className="mono">
                      #{index + 1}.{childIndex + 1}
                    </span>
                    <strong>{child.label.id || t('(tanpa label)', '(no label)')}</strong>
                    <RowTools
                      index={childIndex}
                      count={item.children.length}
                      onMove={(to) => update(index, { ...item, children: moveIn(item.children, childIndex, to) })}
                      onRemove={() => update(index, { ...item, children: item.children.filter((_, i) => i !== childIndex) })}
                    />
                  </div>
                  <MenuNodeFields
                    node={child}
                    onChange={(next) =>
                      update(index, { ...item, children: item.children.map((c, i) => (i === childIndex ? next : c)) })
                    }
                    errors={errors}
                    path={`items.${index}.children.${childIndex}`}
                    lang={lang}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })}
      <div>
        <button
          type="button"
          className="btn btn-line btn-sm"
          disabled={items.length >= 20}
          onClick={() => onChange([...items, emptyMenuNode()])}
        >
          <Icon name="plus" size={14} /> {t('Tambah menu', 'Add menu item')}
        </button>
      </div>
    </div>
  );
}
