import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { CATEGORIES, validateOutput } from '../validators/valuation.validator.js';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    suggested_price: { type: Type.NUMBER },
    range: {
      type: Type.OBJECT,
      properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } },
      required: ['min', 'max'],
    },
    motivation: { type: Type.STRING },
    selling_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
    input_consistency: {
      type: Type.OBJECT,
      properties: {
        matches: { type: Type.BOOLEAN },
        detected_item: { type: Type.STRING },
        // Enum chiuso: il front end può usarlo direttamente per "Correggi i dati"
        detected_category: { type: Type.STRING, enum: [...CATEGORIES, 'Altro'] },
        brand_visible: { type: Type.BOOLEAN },
      },
      required: ['matches', 'detected_item', 'detected_category', 'brand_visible'],
    },
  },
  required: ['suggested_price', 'range', 'motivation', 'selling_tips', 'input_consistency'],
};

// Budget temporale. Il client abbandona a 90 s, cold start di Render incluso (~60 s):
// il server deve chiudere entro 25 s, qualunque cosa succeda.
export const DEFAULTS = {
  deadlineMs: 25000,       // scadenza complessiva della richiesta, tutti i tentativi inclusi
  attemptTimeoutMs: 12000, // tetto per singolo tentativo (mai oltre il tempo residuo)
  maxAttempts: 2,          // per modello
  backoffMs: 1500,         // attesa tra un tentativo e il successivo dello stesso modello
  minAttemptMs: 2000,      // non avviare un tentativo se resta meno di così
};

// 429 escluso: quota esaurita, riprovare lo stesso modello non serve
const RETRYABLE = [500, 503];

class InvalidOutputError extends Error {}
class TimeoutError extends Error {}

export function getStatus(err) {
  if (err instanceof InvalidOutputError) return 'INVALID_OUTPUT';
  if (err instanceof TimeoutError || err?.name === 'AbortError') return 'TIMEOUT';
  if (err?.status) return err.status;
  try { return JSON.parse(err.message).error.code; } catch { return undefined; }
}

// Il modello non conosce la data: senza questo inventa la stagione
export function dateContext(now = new Date()) {
  const m = now.getMonth(); // 0 = gennaio
  const season = m <= 1 || m === 11 ? 'inverno' : m <= 4 ? 'primavera' : m <= 7 ? 'estate' : 'autunno';
  const today = now.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
  return `Data di oggi: ${today} (stagione in Italia: ${season}). Usala per valutare la domanda stagionale e per i consigli sul periodo di pubblicazione.`;
}

function buildRequest(model, item, image, signal) {
  return {
    model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: image.mimetype, data: image.buffer.toString('base64') } },
        { text: `${dateContext()}\n\nDati del capo inseriti dall'utente:\n\`\`\`json\n${JSON.stringify(item)}\n\`\`\`` },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.2,
      // Chiude la connessione allo scadere del tempo. Nota dal SDK: l'annullamento è solo
      // lato client, Google conteggia comunque la richiesta. La quota la protegge la scadenza
      // complessiva (meno tentativi), non l'abort.
      abortSignal: signal,
    },
  };
}

// Factory con dipendenze iniettabili: nei test `generate` e `sleep` sono finti.
export function createValuator({
  generate,
  models,
  deadlineMs = DEFAULTS.deadlineMs,
  attemptTimeoutMs = DEFAULTS.attemptTimeoutMs,
  maxAttempts = DEFAULTS.maxAttempts,
  backoffMs = DEFAULTS.backoffMs,
  minAttemptMs = DEFAULTS.minAttemptMs,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = (msg) => console.warn(msg),
}) {
  async function attempt(model, item, image, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Rete di sicurezza: se generate() ignorasse il segnale, il tentativo scade comunque
    const aborted = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new TimeoutError(`timeout ${timeoutMs} ms`)), { once: true });
    });
    try {
      const res = await Promise.race([generate(buildRequest(model, item, image, controller.signal)), aborted]);
      let data;
      try { data = JSON.parse(res.text); } catch { throw new InvalidOutputError('JSON non parsabile'); }
      const errors = validateOutput(data);
      if (errors.length) throw new InvalidOutputError(errors.join('; '));
      return data;
    } catch (err) {
      if (controller.signal.aborted) throw new TimeoutError(`timeout ${timeoutMs} ms`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return async function valuateItem(item, image) {
    const deadline = now() + deadlineMs;
    let attempts = 0;

    for (const model of models) {
      for (let i = 1; i <= maxAttempts; i++) {
        const remaining = deadline - now();
        if (remaining < minAttemptMs) break;
        attempts++;
        try {
          const data = await attempt(model, item, image, Math.min(attemptTimeoutMs, remaining));
          return { data, model, attempts };
        } catch (err) {
          const status = getStatus(err);
          log(`[gemini] ${model} tentativo ${i}: ${status ?? '?'} ${String(err.message).slice(0, 120)}`);
          // Timeout, quota esaurita o errore non temporaneo: inutile insistere, passa al fallback
          const retryable = RETRYABLE.includes(status) || status === 'INVALID_OUTPUT';
          if (!retryable) break;
          // Riprova solo se dopo l'attesa resta tempo per un tentativo vero
          const wait = backoffMs * i;
          if (i < maxAttempts && deadline - now() - wait >= minAttemptMs) await sleep(wait);
          else break;
        }
      }
    }

    const e = new Error('Servizio di valutazione momentaneamente non disponibile. Riprova tra qualche minuto.');
    e.status = 503;
    throw e;
  };
}

const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

export const valuateItem = createValuator({
  generate: (req) => ai.models.generateContent(req),
  models: env.models,
});
