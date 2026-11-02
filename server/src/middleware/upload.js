import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { MAX_UPLOAD_MB } from '../validators/valuation.validator.js';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// 1) multer: tiene il file in memoria e taglia tutto ciò che supera il limite
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

// 2) Il mimetype dichiarato dal client non conta: conta il contenuto.
//    Legge i primi byte del file (la "firma") e decide cos'è davvero.
export async function detectImageType(buffer) {
  const type = await fileTypeFromBuffer(buffer);
  return type && ALLOWED_TYPES.includes(type.mime) ? type.mime : null;
}

export async function verifyImage(req, res, next) {
  if (!req.file) return next(); // il messaggio "Foto mancante" lo dà la validazione dell'input
  try {
    const mime = await detectImageType(req.file.buffer);
    if (!mime) {
      return res.status(400).json({ error: 'Il file non è un’immagine valida (usa JPG, PNG, WEBP o HEIC)' });
    }
    req.file.mimetype = mime; // a Gemini passiamo il tipo reale, non quello dichiarato
    next();
  } catch (err) {
    next(err);
  }
}
