import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, validateOutput } from '../src/validators/valuation.validator.js';

const file = { buffer: Buffer.from('x') };
const validBody = { category: 'Cappotto', brand: 'Zara', condition: 'buono' };

const validOutput = () => ({
  suggested_price: 30,
  range: { min: 24, max: 36 },
  motivation: 'Trench Zara, fascia mass market, stato buono.',
  selling_tips: ['Fotografa l’etichetta'],
  input_consistency: { matches: true, detected_item: 'Trench', detected_category: 'Cappotto', brand_visible: false },
});

// --- validateInput ---------------------------------------------------------

test('input valido: nessun errore e dati normalizzati', () => {
  const { errors, item } = validateInput({ category: 'Cappotto', brand: '  Zara ', condition: 'BUONO' }, file);
  assert.deepEqual(errors, []);
  assert.deepEqual(item, { category: 'Cappotto', brand: 'Zara', condition: 'buono' });
});

test('input senza foto né campi: un errore per ogni problema', () => {
  const { errors } = validateInput(undefined, undefined);
  assert.equal(errors.length, 4);
  assert.ok(errors.includes('Foto mancante'));
});

test('categoria fuori lista rifiutata', () => {
  const { errors } = validateInput({ ...validBody, category: 'Trench' }, file);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Categoria non valida/);
});

test('stato fuori lista rifiutato', () => {
  const { errors } = validateInput({ ...validBody, condition: 'rotto' }, file);
  assert.match(errors[0], /Stato non valido/);
});

test('brand vuoto o oltre 50 caratteri rifiutato', () => {
  assert.equal(validateInput({ ...validBody, brand: '   ' }, file).errors.length, 1);
  assert.equal(validateInput({ ...validBody, brand: 'x'.repeat(51) }, file).errors.length, 1);
  assert.equal(validateInput({ ...validBody, brand: 'x'.repeat(50) }, file).errors.length, 0);
});

// --- validateOutput --------------------------------------------------------

test('output valido: nessun errore', () => {
  assert.deepEqual(validateOutput(validOutput()), []);
});

test('output non oggetto', () => {
  assert.deepEqual(validateOutput(null), ['Risposta non è un oggetto']);
});

test('prezzo fuori dal range', () => {
  const d = { ...validOutput(), suggested_price: 50 };
  assert.ok(validateOutput(d).includes('suggested_price fuori dal range'));
});

test('range invertito', () => {
  const d = { ...validOutput(), range: { min: 40, max: 20 }, suggested_price: 30 };
  assert.ok(validateOutput(d).includes('range.min > range.max'));
});

test('prezzo negativo, NaN o assurdo rifiutato', () => {
  for (const p of [-1, NaN, Infinity, 1e6, '30']) {
    assert.ok(validateOutput({ ...validOutput(), suggested_price: p }).includes('suggested_price non valido'), `prezzo ${p}`);
  }
});

test('motivation vuota e selling_tips non validi', () => {
  const errs = validateOutput({ ...validOutput(), motivation: ' ', selling_tips: [1, 2] });
  assert.ok(errs.includes('motivation mancante'));
  assert.ok(errs.includes('selling_tips non validi'));
});

test('detected_category fuori enum rifiutata, "Altro" accettata', () => {
  const bad = validOutput(); bad.input_consistency.detected_category = 'Trench';
  assert.ok(validateOutput(bad).includes('detected_category non valida'));
  const other = validOutput(); other.input_consistency.detected_category = 'Altro';
  assert.deepEqual(validateOutput(other), []);
});

test('brand_visible mancante rifiutato', () => {
  const d = validOutput(); delete d.input_consistency.brand_visible;
  assert.ok(validateOutput(d).includes('brand_visible mancante'));
});
