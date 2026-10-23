import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { validateOutput } from '../validators/valuation.validator.js';

const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

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
      },
      required: ['matches', 'detected_item'],
    },
  },
  required: ['suggested_price', 'range', 'motivation', 'selling_tips', 'input_consistency'],
};

const RETRYABLE = [429, 500, 503];
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 20000; // oltre 20 s si passa al tentativo/modello successivo
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class InvalidOutputError extends Error {}
class TimeoutError extends Error {}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`timeout ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function getStatus(err) {
  if (err instanceof InvalidOutputError) return 'INVALID_OUTPUT';
  if (err instanceof TimeoutError) return 'TIMEOUT';
  if (err.status) return err.status;
  try { return JSON.parse(err.message).error.code; } catch { return undefined; }
}

async function callModel(model, item, image) {
  const res = await withTimeout(ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: image.mimetype, data: image.buffer.toString('base64') } },
        { text: `Dati del capo inseriti dall'utente:\n\`\`\`json\n${JSON.stringify(item)}\n\`\`\`` },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.2,
    },
  }), TIMEOUT_MS);

  let data;
  try { data = JSON.parse(res.text); } catch { throw new InvalidOutputError('JSON non parsabile'); }

  const errors = validateOutput(data);
  if (errors.length) throw new InvalidOutputError(errors.join('; '));
  return data;
}

export async function valuateItem(item, image) {
  for (const model of env.models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await callModel(model, item, image);
        return { data, model, attempts: attempt };
      } catch (err) {
        const status = getStatus(err);
        console.warn(`[gemini] ${model} tentativo ${attempt}: ${status ?? '?'} ${err.message.slice(0, 120)}`);
        // Timeout: modello congestionato, inutile riprovare lo stesso -> passa al fallback
        if (status === 'TIMEOUT') break;
        const retryable = RETRYABLE.includes(status) || status === 'INVALID_OUTPUT';
        if (!retryable) break; // es. 404 o 400: passa al modello successivo
        if (attempt < MAX_ATTEMPTS) await sleep(2000 * attempt);
      }
    }
  }
  const e = new Error('Servizio di valutazione momentaneamente non disponibile. Riprova tra qualche minuto.');
  e.status = 503;
  throw e;
}
