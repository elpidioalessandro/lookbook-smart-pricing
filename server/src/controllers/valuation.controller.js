import crypto from 'node:crypto';
import { validateInput } from '../validators/valuation.validator.js';
import { valuateItem } from '../services/gemini.service.js';
import { insertValuation, listValuations, getValuationById } from '../repositories/valuation.repository.js';

export async function createValuation(req, res, next) {
  try {
    const { errors, item } = validateInput(req.body, req.file);
    if (errors.length) return res.status(400).json({ error: 'Dati non validi', details: errors });

    const started = Date.now();
    const { data, model, attempts } = await valuateItem(item, req.file);
    const meta = { model, attempts, latency_ms: Date.now() - started };

    // Il salvataggio non deve bloccare la risposta all'utente:
    // se il DB fallisce, la valutazione viene comunque restituita e l'errore loggato.
    let saved = null;
    try {
      const imageSha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      saved = await insertValuation({ item, image: req.file, imageSha256, data, meta });
    } catch (dbErr) {
      console.error('[db] salvataggio fallito:', dbErr.message);
    }

    res.json({ ...data, meta: { ...meta, id: saved?.id ?? null, saved: Boolean(saved) } });
  } catch (err) {
    next(err);
  }
}

export async function getValuations(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    res.json(await listValuations(limit));
  } catch (err) {
    next(err);
  }
}

export async function getValuation(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id non valido' });
    const row = await getValuationById(id);
    if (!row) return res.status(404).json({ error: 'Valutazione non trovata' });
    res.json(row);
  } catch (err) {
    next(err);
  }
}
