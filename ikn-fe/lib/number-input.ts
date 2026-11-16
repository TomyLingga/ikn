// Pure parsing/formatting behind components/NumberInput (thousands separators while typing).
// A "machine" string is what callers store: optional "-", digits, optional "." + digits ("1234.5"), '' when empty.
// While the user types it may also be "-" or end in "." ("12."); rawValue() strips those before the caller sees it.
// Self-check: node scripts/check-number-input.mjs

export interface NumberSpec {
  /** Thousands separator shown in the field. */
  group: string;
  /** Decimal mark shown in the field. */
  decimal: string;
  /** Maximum fraction digits accepted while typing (0 = integers only). */
  decimals: number;
  /** Whether a leading minus sign is accepted. */
  negative: boolean;
}

/** Fraction digits a `step="any"` field accepts. */
export const FREE_DECIMALS = 6;
/** Longest integer part accepted while typing; keeps Number() exact. */
const MAX_INT_DIGITS = 15;

/** USD groups with "," (1,234.50); rupiah with "." (1.234.567); a plain number follows the UI language. */
export function separatorsFor(currency: string | null | undefined, lang: string): { group: string; decimal: string } {
  const english = currency ? currency.toUpperCase() === 'USD' : lang === 'en';
  return english ? { group: ',', decimal: '.' } : { group: '.', decimal: ',' };
}

/** Fraction digits implied by a native `step`: 1 → 0, 0.05 → 2, "any" → FREE_DECIMALS, absent → 0 (native default step is 1). */
export function stepDecimals(step: number | string | null | undefined): number {
  if (step === 'any') return FREE_DECIMALS;
  const value = Number(step);
  if (step == null || step === '' || !Number.isFinite(value) || value <= 0) return 0;
  return (value.toFixed(FREE_DECIMALS).replace(/0+$/, '').split('.')[1] || '').length;
}

/** A caller's value (string or number, possibly exponent notation) as a machine string; not a number → ''. */
export function normalizeMachine(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (/^-?\d*(\.\d*)?$/.test(text)) return text;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 }) : '';
}

/** Machine string → field text. Keeps "-", a trailing decimal mark and trailing zeros, so "12." shows as "12," while typing. */
export function formatMachine(machine: string, spec: Pick<NumberSpec, 'group' | 'decimal'>): string {
  const negative = machine.startsWith('-');
  const body = negative ? machine.slice(1) : machine;
  const dot = body.indexOf('.');
  const int = dot < 0 ? body : body.slice(0, dot);
  const head = int === '' && dot >= 0 ? '0' : int.replace(/\B(?=(\d{3})+(?!\d))/g, spec.group);
  return (negative ? '-' : '') + head + (dot < 0 ? '' : spec.decimal + body.slice(dot + 1));
}

/** Number identity of a machine string: '' without digits; "-0", "007", "1.50", "12." become "0", "7", "1.5", "12". */
export function canonical(machine: string): string {
  if (!/\d/.test(machine)) return '';
  const negative = machine.startsWith('-');
  const [intPart = '', fractionPart = ''] = (negative ? machine.slice(1) : machine).split('.');
  const int = intPart.replace(/^0+(?=\d)/, '') || '0';
  const fraction = fractionPart.replace(/0+$/, '');
  const body = fraction ? `${int}.${fraction}` : int;
  return negative && body !== '0' ? `-${body}` : body;
}

/** What the caller receives: '' when there are no digits, no trailing decimal point. Trailing zeros stay ("12.50"). */
export function rawValue(machine: string): string {
  if (!/\d/.test(machine)) return '';
  return machine.endsWith('.') ? machine.slice(0, -1) : machine;
}

export interface EditResult {
  machine: string;
  /** Regrouped field text. */
  text: string;
  /** Caret index inside `text`. */
  caret: number;
}

/**
 * Field text right after a keystroke → machine string, regrouped text and the caret's new place.
 * Strict about the field's locale: the group separator is dropped, only `spec.decimal` (or the character at
 * `decimalAt`, see typedGroupIsDecimal) starts the fraction. Leading zeros and digits past `spec.decimals` are dropped.
 * `forward` (Delete key) puts the caret after a group separator instead of before it, so repeated Delete keeps moving.
 */
export function editText(text: string, caret: number, spec: NumberSpec, options: { decimalAt?: number; forward?: boolean } = {}): EditResult {
  let sign = '';
  let int = '';
  let fraction = '';
  let hasMark = false;
  let position = 0; // caret index inside sign + int + mark + fraction
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? '';
    let kept = false;
    if (char >= '0' && char <= '9') {
      if (hasMark) {
        if (fraction.length < spec.decimals) {
          fraction += char;
          kept = true;
        }
      } else if (int.length < MAX_INT_DIGITS) {
        int += char;
        kept = true;
      }
    } else if ((char === spec.decimal || index === options.decimalAt) && spec.decimals > 0 && !hasMark) {
      hasMark = true;
      kept = true;
    } else if ((char === '-' || char === '−') && spec.negative && !sign && !int && !hasMark) {
      sign = '-';
      kept = true;
    }
    if (kept && index < caret) position += 1;
  }

  const trimmed = int.replace(/^0+(?=\d)/, '');
  if (position > sign.length) position = Math.max(sign.length, position - (int.length - trimmed.length));
  int = trimmed;
  if (int === '' && hasMark) {
    int = '0';
    if (position > sign.length) position += 1;
  }

  const machine = sign + int + (hasMark ? `.${fraction}` : '');
  const display = formatMachine(machine, spec);
  let displayCaret = 0;
  for (let counted = 0; displayCaret < display.length && counted < position; displayCaret += 1) {
    if (display[displayCaret] !== spec.group) counted += 1;
  }
  if (options.forward && display[displayCaret] === spec.group) displayCaret += 1;
  return { machine, text: display, caret: displayCaret };
}

/**
 * A group separator typed at `index` acts as the decimal mark when it cannot be a thousands separator: the field never
 * reaches 1,000 (`neverGrouped`), nothing but zeros stands before it ("0.5"), or the digits after it are not groups of three.
 */
export function typedGroupIsDecimal(text: string, index: number, spec: NumberSpec, neverGrouped = false): boolean {
  if (spec.decimals === 0 || text.includes(spec.decimal)) return false;
  if (neverGrouped) return true;
  const before = text.slice(0, index).replace(/\D/g, '');
  const after = text.slice(index + 1).replace(/\D/g, '');
  if (/^0*$/.test(before)) return true;
  return after.length > 0 && after.length % 3 !== 0 && after.length <= spec.decimals;
}

/**
 * Pasted text → machine string ('' when it holds no number). Lenient about the source format: "1.234.567,50",
 * "1,234,567.50" and "1234567.5" all give 1234567.5. With both signs present the last one is the decimal mark; a lone
 * sign follows the field's locale unless the digits around it rule that reading out.
 */
export function parsePasted(text: string, spec: NumberSpec): string {
  const negative = spec.negative && /^[^\d.,]*[-−]/.test(text);
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return '';

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let mark = '';
  if (lastDot >= 0 && lastComma >= 0) {
    mark = lastDot > lastComma ? '.' : ',';
    if (cleaned.indexOf(mark) !== cleaned.lastIndexOf(mark)) mark = '';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sign = lastDot >= 0 ? '.' : ',';
    const parts = cleaned.split(sign);
    // "1.234" reads as a grouped integer; "1234.5", "0.500" and "12.50" cannot be one.
    const grouped = /^[1-9]\d{0,2}$/.test(parts[0] ?? '') && parts.slice(1).every((part) => part.length === 3);
    if (parts.length > 2) mark = ''; // a sign that repeats is never a decimal mark
    else if (sign === spec.group) mark = grouped ? '' : sign;
    else mark = grouped && spec.decimals === 0 ? '' : sign;
  }

  const at = mark ? cleaned.lastIndexOf(mark) : -1;
  const int = (at < 0 ? cleaned : cleaned.slice(0, at)).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS) || '0';
  const fraction = at < 0 ? '' : cleaned.slice(at + 1).replace(/\D/g, '').slice(0, spec.decimals);
  return (negative ? '-' : '') + int + (fraction ? `.${fraction}` : '');
}

/** Value after blur: raw value held inside [min, max]; '' stays ''. */
export function clampMachine(machine: string, min?: number, max?: number): string {
  const raw = rawValue(machine);
  if (raw === '') return '';
  const value = Number(raw);
  if (min !== undefined && value < min) return normalizeMachine(min);
  if (max !== undefined && value > max) return normalizeMachine(max);
  return raw;
}

/** Fraction padded with zeros to `decimals` ("12.5" → "12.50"); used for money fields after blur. */
export function padFraction(machine: string, decimals: number): string {
  if (decimals <= 0 || !/\d/.test(machine)) return machine;
  const [int = '', fraction = ''] = machine.split('.');
  return `${int}.${fraction.padEnd(decimals, '0')}`;
}

/** Arrow key step: value + delta inside [min, max], keeping as many fraction digits as the value or the step has. */
export function stepMachine(machine: string, delta: number, min?: number, max?: number): string {
  const raw = rawValue(machine);
  const places = Math.max((raw.split('.')[1] || '').length, stepDecimals(Math.abs(delta)));
  const next = (Number(raw) || 0) + delta;
  if (min !== undefined && next < min) return normalizeMachine(min);
  if (max !== undefined && next > max) return normalizeMachine(max);
  return next.toFixed(Math.min(places, 20));
}
