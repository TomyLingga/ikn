'use client';

import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import type { FieldDef } from '@/lib/cms';
import type { IconName } from '@/lib/types';
import ColorInput from './ColorInput';
import GeoPicker, { type GeoValue } from './GeoPicker';

// Scalar inputs for schema fields: text, textarea, number, boolean, url, select, icon, color, geo.
interface FieldInputProps {
  label: string;
  def: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  icons?: string[];
  error?: string;
}

export default function FieldInput({ label, def, value, onChange, icons = [], error }: FieldInputProps) {
  const text = value == null ? '' : String(value);
  const required = def.required ? <span className="cms-req">*</span> : null;

  if (def.type === 'boolean') {
    return (
      <label className="cms-check">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
        {error && <small className="cms-field-error">{error}</small>}
      </label>
    );
  }

  if (def.type === 'geo') {
    // Bukan <label>: peta dan tombol di dalamnya tidak boleh memicu fokus input pertama.
    return (
      <div className="cms-field">
        <span className="field-label">
          {label}
          {required}
        </span>
        <GeoPicker value={(value as GeoValue | null | undefined) ?? null} onChange={onChange} />
        {error && <small className="cms-field-error">{error}</small>}
      </div>
    );
  }

  let control: ReactNode;
  switch (def.type) {
    case 'textarea':
      control = <textarea rows={4} value={text} maxLength={def.max} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'number':
      control = (
        <input
          type="number"
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
      break;
    case 'select':
      control = (
        <select value={text} onChange={(e) => onChange(e.target.value)}>
          {!def.required && <option value="">—</option>}
          {Object.entries(def.options ?? {}).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      );
      break;
    case 'icon':
      control = (
        <div className="cms-icon-row">
          <span className="cms-icon-preview" aria-hidden="true">
            {text !== '' && icons.includes(text) ? <Icon name={text as IconName} size={18} /> : null}
          </span>
          <select value={text} onChange={(e) => onChange(e.target.value)}>
            <option value="">— pilih ikon —</option>
            {icons.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      );
      break;
    case 'color':
      control = <ColorInput value={text} onChange={onChange} label={label} />;
      break;
    case 'url':
      control = (
        <input
          type="text"
          value={text}
          maxLength={def.max}
          placeholder="https://... atau /halaman"
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    default:
      control = <input type="text" value={text} maxLength={def.max} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <label className="cms-field">
      <span className="field-label">
        {label}
        {required}
      </span>
      {control}
      {error && <small className="cms-field-error">{error}</small>}
    </label>
  );
}
