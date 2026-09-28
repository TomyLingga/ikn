'use client';

import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import type { FieldDef } from '@/lib/cms';
import type { IconName } from '@/lib/types';

// Scalar inputs for schema fields: text, textarea, number, boolean, url, select, icon, color.
const HEX = /^#[0-9a-f]{6}$/i;
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
      control = (
        <div className="cms-color-row">
          <input
            type="color"
            value={HEX.test(text) ? text : '#ffffff'}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            aria-label={label}
          />
          <input
            type="text"
            value={text}
            maxLength={7}
            placeholder="kosong = warna bawaan"
            onChange={(e) => onChange(e.target.value.trim())}
            className="mono"
          />
          <button type="button" className="row-act" onClick={() => onChange('')} disabled={text === ''}>
            Bawaan
          </button>
        </div>
      );
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
