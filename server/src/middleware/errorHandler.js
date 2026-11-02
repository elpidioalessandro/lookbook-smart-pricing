import multer from 'multer';
import { MAX_UPLOAD_MB } from '../validators/valuation.validator.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `Immagine troppo grande (max ${MAX_UPLOAD_MB} MB)` : err.message;
    return res.status(400).json({ error: msg });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? 'Errore interno del server' : err.message });
}
