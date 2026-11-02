import { CATEGORIES, CONDITION_OPTIONS, MAX_UPLOAD_MB } from '../validators/valuation.validator.js';

// Unica fonte di verità per le opzioni del form: il client le legge da qui
export function getConfig(req, res) {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ categories: CATEGORIES, conditions: CONDITION_OPTIONS, maxUploadMb: MAX_UPLOAD_MB });
}
