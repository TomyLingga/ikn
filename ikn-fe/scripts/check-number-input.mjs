// Self-check for lib/number-input.ts (the repo has no FE test runner). Run from ikn-fe/: node scripts/check-number-input.mjs
// Transpiles the TypeScript source with the installed `typescript` package, then asserts the pure functions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../lib/number-input.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const loaded = { exports: {} };
new Function('module', 'exports', outputText)(loaded, loaded.exports);
const { canonical, clampMachine, editText, formatMachine, normalizeMachine, padFraction, parsePasted, rawValue, separatorsFor, stepDecimals, stepMachine, typedGroupIsDecimal } =
  loaded.exports;

const spec = (currency, lang, decimals, negative = false) => ({ ...separatorsFor(currency, lang), decimals, negative });
const IDR = spec('IDR', 'en', 0);
const USD = spec('USD', 'id', 2);
const ID = spec(null, 'id', 2, true);
const EN = spec(null, 'en', 2, true);
let checks = 0;
const eq = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  checks += 1;
};
/** "12|34" → edit at the "|" caret; returns the result in the same notation. */
const edit = (marked, fieldSpec, options) => {
  const caret = marked.indexOf('|');
  const result = editText(marked.replace('|', ''), caret, fieldSpec, options);
  return [`${result.text.slice(0, result.caret)}|${result.text.slice(result.caret)}`, result.machine];
};

// Separators: currency wins over language; plain numbers follow the language.
eq(separatorsFor('USD', 'id'), { group: ',', decimal: '.' }, 'USD');
eq(separatorsFor('IDR', 'en'), { group: '.', decimal: ',' }, 'IDR');
eq(separatorsFor('usd', 'id'), { group: ',', decimal: '.' }, 'usd lowercase');
eq(separatorsFor(null, 'id'), { group: '.', decimal: ',' }, 'plain id');
eq(separatorsFor(undefined, 'en'), { group: ',', decimal: '.' }, 'plain en');

// Decimals from step.
eq([1, 0.01, 0.05, 0.1, 'any', undefined, '', '0.001', 5].map(stepDecimals), [0, 2, 2, 1, 6, 0, 0, 3, 0], 'stepDecimals');

// Formatting a stored value.
eq(formatMachine('1234567', IDR), '1.234.567', 'IDR');
eq(formatMachine('1234.50', USD), '1,234.50', 'USD');
eq(formatMachine('1234.5', ID), '1.234,5', 'plain id');
eq(formatMachine('1234.5', EN), '1,234.5', 'plain en');
eq(formatMachine('-1234567.25', ID), '-1.234.567,25', 'negative');
eq(formatMachine('12.', ID), '12,', 'trailing mark kept');
eq(formatMachine('12.50', ID), '12,50', 'trailing zeros kept');
eq(formatMachine('', ID), '', 'empty');
eq(formatMachine('-', ID), '-', 'lone minus');
eq(formatMachine('999', IDR), '999', 'no group below 1000');
eq(formatMachine('100000', IDR), '100.000', 'six digits');
eq(formatMachine('.5', EN), '0.5', 'missing integer part');

// Values from callers.
eq(normalizeMachine(1234.5), '1234.5', 'number');
eq(normalizeMachine('  12.50 '), '12.50', 'string');
eq(normalizeMachine(null), '', 'null');
eq(normalizeMachine('abc'), '', 'garbage');
eq(normalizeMachine(1e21), '1000000000000000000000', 'exponent number');
eq(normalizeMachine('1e3'), '1000', 'exponent string');
eq(normalizeMachine(0), '0', 'zero');

// Number identity and raw value.
eq(['', '-', '-0', '007', '1.50', '12.', '-1.20', '0.0'].map(canonical), ['', '', '0', '7', '1.5', '12', '-1.2', '0'], 'canonical');
eq(['', '-', '12.', '12.50', '-0', '0.'].map(rawValue), ['', '', '12', '12.50', '-0', '0'], 'rawValue');

// Typing digits at the end regroups and keeps the caret at the end.
eq(edit('1.2345|', IDR), ['12.345|', '12345'], 'append digit IDR');
eq(edit('1,2345|', USD), ['12,345|', '12345'], 'append digit USD');
eq(edit('999.9999|', IDR), ['9.999.999|', '9999999'], 'append to millions');
// Typing and deleting in the middle keeps the caret after the same digit.
eq(edit('1.29|34', IDR), ['12.9|34', '12934'], 'insert in the middle');
eq(edit('9|1.234', IDR), ['9|1.234', '91234'], 'insert at the start');
eq(edit('1.|34', IDR), ['1|34', '134'], 'backspace a digit');
eq(edit('1|234', IDR), ['1|.234', '1234'], 'backspace over a separator');
eq(edit('1|234', IDR, { forward: true }), ['1.|234', '1234'], 'delete over a separator');
eq(edit('|.234', IDR), ['|234', '234'], 'delete the first digit');
eq(edit('1.234.5|7', IDR), ['123.45|7', '123457'], 'delete near the end');
// Decimal mark: the locale's mark starts the fraction, the group separator is dropped.
eq(edit('12,|', ID), ['12,|', '12.'], 'trailing mark stays');
eq(edit('12,5|', ID), ['12,5|', '12.5'], 'one decimal');
eq(edit('12,50|', ID), ['12,50|', '12.50'], 'trailing zero stays');
eq(edit('12,507|', ID), ['12,50|', '12.50'], 'third decimal ignored');
eq(edit('12.|', ID), ['12|', '12'], 'typed group separator ignored (ID)');
eq(edit('12,|', USD), ['12|', '12'], 'typed group separator ignored (USD)');
eq(edit('12.|', USD), ['12.|', '12.'], 'USD decimal point');
eq(edit('1.234,5|', ID), ['1.234,5|', '1234.5'], 'grouped with fraction');
eq(edit('1,2|,50', ID), ['1,2|5', '1.25'], 'second mark ignored');
eq(edit(',|', ID), ['0,|', '0.'], 'mark first gives a leading zero');
eq(edit(',5|', EN), ['5|', '5'], 'comma is grouping in EN');
eq(edit('12,|', IDR), ['12|', '12'], 'no fraction in rupiah');
eq(edit('12.|5', IDR), ['12|5', '125'], 'no fraction in rupiah, dot');
// A group separator that is explicitly resolved as the decimal mark (see typedGroupIsDecimal).
eq(edit('0.|', ID, { decimalAt: 1 }), ['0,|', '0.'], 'decimalAt');
eq(edit('12.|50', ID, { decimalAt: 2 }), ['12,|50', '12.50'], 'decimalAt in the middle');
// Leading zeros, minus sign, junk.
eq(edit('05|', IDR), ['5|', '5'], 'leading zero');
eq(edit('0|1.234', IDR), ['|1.234', '1234'], 'leading zero typed at the start');
eq(edit('00|', IDR), ['0|', '0'], 'double zero');
eq(edit('0,05|', ID), ['0,05|', '0.05'], 'zero before the mark stays');
eq(edit('-|', ID), ['-|', '-'], 'lone minus');
eq(edit('-|', IDR), ['|', ''], 'minus refused when not negative');
eq(edit('-1234|', ID), ['-1.234|', '-1234'], 'negative');
eq(edit('12-|', ID), ['12|', '12'], 'minus only leads');
eq(edit('−5|', ID), ['-5|', '-5'], 'unicode minus');
eq(edit('12a|', IDR), ['12|', '12'], 'letters dropped');
eq(edit('1e5|', IDR), ['15|', '15'], 'no exponent');
eq(edit('|', IDR), ['|', ''], 'empty');
eq(edit('1234567890123456789|', IDR)[1], '123456789012345', 'integer part capped at 15 digits');

// When a typed group separator can only be a decimal mark.
eq(typedGroupIsDecimal('0.', 1, ID), true, '0. is decimal');
eq(typedGroupIsDecimal('.', 0, ID), true, 'lone . is decimal');
eq(typedGroupIsDecimal('12.', 2, ID), false, '12. may be grouping');
eq(typedGroupIsDecimal('1.234', 1, ID), false, '1.234 is grouping');
eq(typedGroupIsDecimal('12.50', 2, ID), true, 'two digits after cannot be a group');
eq(typedGroupIsDecimal('1.2345', 1, ID), false, 'would drop digits');
eq(typedGroupIsDecimal('12.', 2, ID, true), true, 'field below 1000');
eq(typedGroupIsDecimal('0.', 1, IDR), false, 'integer field');
eq(typedGroupIsDecimal('1,5.', 3, ID), false, 'already has a mark');
eq(typedGroupIsDecimal('0,', 1, USD), true, 'USD 0, is decimal');

// Paste: both notations and the bare machine form, in every kind of field.
for (const [label, fieldSpec] of [['USD', USD], ['ID', ID], ['EN', EN]]) {
  eq(parsePasted('1.234.567,50', fieldSpec), '1234567.50', `${label} paste id format`);
  eq(parsePasted('1,234,567.50', fieldSpec), '1234567.50', `${label} paste en format`);
  eq(parsePasted('1234567.5', fieldSpec), '1234567.5', `${label} paste machine format`);
}
eq(['1.234.567,50', '1,234,567.50', '1234567.5', '1.234.567', '1,234,567'].map((text) => parsePasted(text, IDR)), ['1234567', '1234567', '1234567', '1234567', '1234567'], 'IDR paste drops the fraction');
eq(parsePasted('1.234', ID), '1234', 'lone group sign, groups of three');
eq(parsePasted('1,234', ID), '1.23', 'lone decimal sign in a decimal field');
eq(parsePasted('1,234', IDR), '1234', 'lone decimal sign in an integer field reads as grouping');
eq(parsePasted('1,234', USD), '1234', 'USD grouping');
eq(parsePasted('1.234', USD), '1.23', 'USD decimal point');
eq(parsePasted('12,5', USD), '12.5', 'comma that cannot group is decimal');
eq(parsePasted('0.5', ID), '0.5', 'dot that cannot group is decimal');
eq(parsePasted('Rp 1.250.000', IDR), '1250000', 'currency prefix');
eq(parsePasted('USD 1,250.00', USD), '1250.00', 'currency code');
eq(parsePasted(' 12 500 ', IDR), '12500', 'spaces');
eq(parsePasted('-1.500', ID), '-1500', 'negative');
eq(parsePasted('-1.500', IDR), '1500', 'minus refused when not negative');
eq(parsePasted('abc', ID), '', 'no number');
eq(parsePasted('007', IDR), '7', 'leading zeros');
eq(parsePasted('12,3456', ID), '12.34', 'extra decimals cut');

// Blur: clamp, pad money; arrow keys.
eq(clampMachine('150', 0, 100), '100', 'clamp max');
eq(clampMachine('0', 1, undefined), '1', 'clamp min');
eq(clampMachine('0', 0.01), '0.01', 'clamp fractional min');
eq(clampMachine('12.', 0, 100), '12', 'in range, tidied');
eq(clampMachine('-', 0, 100), '', 'no digits');
eq(clampMachine('', 5, 10), '', 'empty stays empty');
eq(clampMachine('12.50', undefined, undefined), '12.50', 'no limits');
eq(padFraction('12.5', 2), '12.50', 'pad');
eq(padFraction('12', 2), '12.00', 'pad integer');
eq(padFraction('', 2), '', 'pad empty');
eq(padFraction('12', 0), '12', 'no pad for rupiah');
eq(stepMachine('', 1, 1, 10), '1', 'step from empty');
eq(stepMachine('9', 1, 1, 10), '10', 'step up');
eq(stepMachine('10', 1, 1, 10), '10', 'step held at max');
eq(stepMachine('0.1', 0.2), '0.3', 'step without float noise');
eq(stepMachine('12.50', 0.01), '12.51', 'step cents');
eq(stepMachine('0', -1, 0), '0', 'step held at min');
eq(stepMachine('5', -1), '4', 'step down');

console.log(`number-input: ${checks} checks passed`);
