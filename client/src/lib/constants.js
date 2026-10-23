// Devono restare allineate con server/src/validators/valuation.validator.js
export const CATEGORIES = [
  'T-shirt', 'Camicia', 'Maglione', 'Felpa', 'Giacca', 'Cappotto',
  'Pantaloni', 'Jeans', 'Gonna', 'Vestito', 'Scarpe', 'Borsa', 'Accessori',
];

export const CONDITIONS = [
  { value: 'nuovo', label: 'Nuovo', hint: 'Mai indossato' },
  { value: 'buono', label: 'Buono', hint: 'Pochi segni d’uso' },
  { value: 'usato', label: 'Usato', hint: 'Segni visibili' },
];

// Peso massimo della foto PRIMA della compressione nel browser (il server accetta max 5 MB dopo)
export const MAX_RAW_MB = 20;
