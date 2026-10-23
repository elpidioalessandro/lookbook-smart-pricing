import { validateInput } from '../validators/valuation.validator.js';
import { valuateItem } from '../services/gemini.service.js';

export async function createValuation(req, res, next) {
  try {
    const { errors, item } = validateInput(req.body, req.file);
    if (errors.length) return res.status(400).json({ error: 'Dati non validi', details: errors });

    const started = Date.now();
    const { data, model, attempts } = await valuateItem(item, req.file);

    // TODO fase 4: salvataggio su Postgres (input, output, modello, latenza)

    res.json({
      ...data,
      meta: { model, attempts, latency_ms: Date.now() - started },
    });
  } catch (err) {
    next(err);
  }
}
