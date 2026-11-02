import { rateLimit } from 'express-rate-limit';

const json = (message) => (req, res) => res.status(429).json({ error: message });

// Per indirizzo IP: un utente normale fa poche valutazioni; uno script no.
export const valuatePerIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_IP) || 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: json('Troppe valutazioni in poco tempo. Riprova tra qualche minuto.'),
});

// Tetto globale giornaliero: protegge la quota gratuita di Gemini anche da richieste
// distribuite su molti IP. In memoria: si azzera al riavvio del server.
export const valuateGlobal = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL_DAILY) || 200,
  keyGenerator: () => 'global',
  standardHeaders: false,
  legacyHeaders: false,
  handler: json('Limite giornaliero del servizio raggiunto. Riprova domani.'),
});

// Letture (config, storico): limite largo, solo contro gli abusi
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: json('Troppe richieste. Riprova tra un minuto.'),
});
