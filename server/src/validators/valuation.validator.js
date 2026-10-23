export const CATEGORIES = [
  'T-shirt', 'Camicia', 'Maglione', 'Felpa', 'Giacca', 'Cappotto',
  'Pantaloni', 'Jeans', 'Gonna', 'Vestito', 'Scarpe', 'Borsa', 'Accessori',
];
export const CONDITIONS = ['nuovo', 'buono', 'usato'];

// --- INPUT: quello che arriva dal form -------------------------------------
export function validateInput(body = {}, file) {
  const errors = [];
  const category = String(body.category ?? '').trim();
  const brand = String(body.brand ?? '').trim();
  const condition = String(body.condition ?? '').trim().toLowerCase();

  if (!file) errors.push('Foto mancante');
  if (!CATEGORIES.includes(category)) errors.push(`Categoria non valida. Valori ammessi: ${CATEGORIES.join(', ')}`);
  if (brand.length < 1 || brand.length > 50) errors.push('Brand obbligatorio (max 50 caratteri)');
  if (!CONDITIONS.includes(condition)) errors.push(`Stato non valido. Valori ammessi: ${CONDITIONS.join(', ')}`);

  return { errors, item: { category, brand, condition } };
}

// --- OUTPUT: quello che restituisce l'LLM ----------------------------------
const MAX_PRICE = 10000;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_PRICE;

export function validateOutput(d) {
  const errors = [];
  if (!d || typeof d !== 'object') return ['Risposta non è un oggetto'];

  if (!isNum(d.suggested_price)) errors.push('suggested_price non valido');
  if (!d.range || !isNum(d.range.min) || !isNum(d.range.max)) errors.push('range non valido');
  else {
    if (d.range.min > d.range.max) errors.push('range.min > range.max');
    if (isNum(d.suggested_price) && (d.suggested_price < d.range.min || d.suggested_price > d.range.max))
      errors.push('suggested_price fuori dal range');
  }
  if (typeof d.motivation !== 'string' || d.motivation.trim().length < 10) errors.push('motivation mancante');
  if (!Array.isArray(d.selling_tips) || d.selling_tips.length < 1 || d.selling_tips.some((t) => typeof t !== 'string'))
    errors.push('selling_tips non validi');
  if (!d.input_consistency || typeof d.input_consistency.matches !== 'boolean')
    errors.push('input_consistency mancante');

  return errors;
}
