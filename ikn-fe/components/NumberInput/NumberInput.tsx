'use client';

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FocusEvent, InputHTMLAttributes, KeyboardEvent, SyntheticEvent } from 'react';
import { useLang } from '@/components/LanguageProvider';
import { currencyDecimals } from '@/lib/format';
import {
  canonical,
  clampMachine,
  editText,
  formatMachine,
  normalizeMachine,
  padFraction,
  parsePasted,
  rawValue,
  separatorsFor,
  stepDecimals,
  stepMachine,
  typedGroupIsDecimal,
  type NumberSpec,
} from '@/lib/number-input';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> {
  /** Raw value exactly as callers store it today: "1234.5", 1234.5 or '' (dot decimal, no grouping). */
  value?: string | number | null;
  defaultValue?: string | number | null;
  /** Same shape as a native onChange; `e.target.value` is the raw machine string ("1234.5", '' when empty). */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Money field: sets the separators (USD "1,234.50", any other currency "1.234.567") and the fraction digits. */
  currency?: string | null;
  /** Fraction digits. Default: from `currency`, else from `step` (1 → 0, 0.01 → 2, "any" → 6). */
  decimals?: number;
}

function bound(value: number | string | undefined): number | undefined {
  return value === undefined || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);
}

/**
 * Drop-in replacement for <input type="number"> that shows thousands separators while typing. Callers keep the raw
 * value they already use (`value` in, `e.target.value` out), so existing handlers and submit code do not change.
 * Without `currency` the separators follow the UI language (ID "1.234,5", EN "1,234.5"). `min`/`max` are checked for
 * form submit (message in the UI language) and applied on blur; ArrowUp/ArrowDown step by `step`.
 * It renders a plain text input, so the surrounding input styles apply as they are.
 */
const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, defaultValue, onChange, onBlur, onKeyDown, onPaste, currency, decimals, min, max, step, name, inputMode, placeholder, ...props },
  forwardedRef,
) {
  const { lang } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const edited = useRef(false);
  // What the user is typing, in machine notation; may hold "12." or "-", which the caller's value cannot.
  const [typing, setTyping] = useState(() => normalizeMachine(value ?? defaultValue));
  const [ios, setIos] = useState(false);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  }, []);

  const minValue = bound(min);
  const maxValue = bound(max);
  const negative = minValue === undefined || minValue < 0;
  const spec: NumberSpec = {
    ...separatorsFor(currency, lang),
    decimals: decimals ?? (currency ? currencyDecimals(currency) : stepDecimals(step)),
    negative,
  };
  // iOS keypads have no minus key, so fields that accept negatives get the full keyboard there.
  const mode = inputMode ?? (ios && negative ? 'text' : spec.decimals > 0 ? 'decimal' : 'numeric');
  // The iOS decimal keypad has a single separator key (the phone's own decimal mark): whatever it sends is a decimal mark.
  // The same goes for a field that can never reach 1,000.
  const groupMeansDecimal = (ios && mode === 'decimal') || (maxValue !== undefined && maxValue < 1000 && minValue !== undefined && minValue > -1000);

  // The caller's value wins as soon as it is a different number from what was typed (reset, clamp, edit elsewhere).
  const fromProp = normalizeMachine(value);
  const machine = value === undefined || canonical(typing) === canonical(fromProp) ? typing : fromProp;
  const text = formatMachine(machine, spec);

  const shown = (limit: number) => formatMachine(normalizeMachine(limit), spec);
  const raw = rawValue(machine);
  let invalid = '';
  if (raw === '') invalid = machine === '' ? '' : lang === 'en' ? 'Enter a number.' : 'Masukkan angka.';
  else if (minValue !== undefined && Number(raw) < minValue) invalid = lang === 'en' ? `Value must be at least ${shown(minValue)}.` : `Nilai minimal ${shown(minValue)}.`;
  else if (maxValue !== undefined && Number(raw) > maxValue) invalid = lang === 'en' ? `Value must be at most ${shown(maxValue)}.` : `Nilai maksimal ${shown(maxValue)}.`;
  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid);
  }, [invalid]);

  /** Calls onChange with an event whose target reads like the input but reports the raw value. */
  const emit = (nextRaw: string, source: SyntheticEvent) => {
    const element = inputRef.current;
    if (!onChange || !element) return;
    const target = new Proxy(element, {
      get(node, property) {
        if (property === 'value') return nextRaw;
        if (property === 'valueAsNumber') return nextRaw === '' ? Number.NaN : Number(nextRaw);
        if (property === 'name') return name ?? '';
        const member = Reflect.get(node, property);
        return typeof member === 'function' ? member.bind(node) : member;
      },
    });
    onChange(Object.create(source, { target: { value: target }, currentTarget: { value: target } }) as ChangeEvent<HTMLInputElement>);
  };

  const commit = (nextText: string, caret: number, source: SyntheticEvent, options?: { decimalAt?: number; forward?: boolean }) => {
    const element = inputRef.current;
    if (!element) return;
    const result = editText(nextText, caret, spec, options);
    // Write the regrouped text and the caret now. React then finds the value it renders already in place and leaves
    // the caret alone; a re-render alone would move it to the end.
    element.value = result.text;
    element.setSelectionRange(result.caret, result.caret);
    edited.current = true;
    setTyping(result.machine);
    emit(rawValue(result.machine), source);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    const caret = element.selectionStart ?? element.value.length;
    const native = event.nativeEvent as InputEvent;
    const typedGroup = native.inputType === 'insertText' && native.data === spec.group && element.value[caret - 1] === spec.group;
    commit(element.value, caret, event, {
      decimalAt: typedGroup && typedGroupIsDecimal(element.value, caret - 1, spec, groupMeansDecimal) ? caret - 1 : undefined,
      forward: native.inputType === 'deleteContentForward',
    });
  };

  // Paste accepts either notation ("1.234.567,50", "1,234,567.50", "1234567.5") and lands in the field's own.
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event);
    const element = event.currentTarget;
    if (event.defaultPrevented || element.readOnly) return;
    event.preventDefault();
    const pasted = parsePasted(event.clipboardData.getData('text'), spec).replace('.', spec.decimal);
    if (!pasted) return;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    commit(element.value.slice(0, start) + pasted + element.value.slice(end), start + pasted.length, event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    const element = event.currentTarget;
    if (event.defaultPrevented || element.readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.shiftKey) {
      event.preventDefault();
      const size = Number(step) > 0 ? Number(step) : 1;
      const next = stepMachine(machine, event.key === 'ArrowUp' ? size : -size, minValue, maxValue);
      edited.current = true;
      setTyping(next);
      emit(next, event);
    } else if (event.code === 'NumpadDecimal' && spec.decimals > 0) {
      // The numpad decimal key means "decimal mark" whichever character the keyboard layout sends for it.
      event.preventDefault();
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? start;
      commit(element.value.slice(0, start) + spec.decimal + element.value.slice(end), start + 1, event);
    }
  };

  // Leaving an edited field: hold the value inside min/max, drop a dangling "-" or decimal mark, pad money to full cents.
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (edited.current) {
      edited.current = false;
      const held = clampMachine(machine, minValue, maxValue);
      const next = currency ? padFraction(held, spec.decimals) : held;
      setTyping(next);
      if (canonical(held) !== canonical(machine)) emit(next, event);
    }
    onBlur?.(event);
  };

  const input = (
    <input
      autoComplete="off"
      {...props}
      ref={setRefs}
      type="text"
      inputMode={mode}
      value={text}
      placeholder={placeholder && /^-?\d+(\.\d+)?$/.test(placeholder) ? formatMachine(placeholder, spec) : placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
  if (!name) return input;
  // A named field submits the raw value, not the grouped text.
  return (
    <>
      {input}
      <input type="hidden" name={name} value={raw} disabled={props.disabled} />
    </>
  );
});

export default NumberInput;
