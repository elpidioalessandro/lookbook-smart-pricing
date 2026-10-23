// server/scripts/test-gemini.js
// Uso: node scripts/test-gemini.js ./foto.jpg
// .env: GEMINI_API_KEY=...  GEMINI_MODEL=gemini-3.8-flash  GEMINI_FALLBACK_MODEL=gemini-3.5-flash

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Passa il percorso di una foto: node scripts/test-gemini.js ./foto.jpg');
  process.exit(1);
}

const mimeByExt = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const mimeType = mimeByExt[path.extname(imagePath).toLowerCase()];
if (!mimeType) {
  console.error('Formato non supportato: usa jpg, png o webp');
  process.exit(1);
}

const base64 = fs.readFileSync(imagePath).toString('base64');

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
  },
  required: ['suggested_price', 'range', 'motivation', 'selling_tips'],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const item = { category: 'Felpa', brand: 'Nike', condition: 'buono' };

const models = [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter(Boolean);
const RETRYABLE = [429, 500, 503];
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getStatus(err) {
  if (err.status) return err.status;
  try {
    return JSON.parse(err.message).error.code;
  } catch {
    return undefined;
  }
}

async function callModel(model) {
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: `Dati del capo:\n\`\`\`json\n${JSON.stringify(item)}\n\`\`\`` },
        ],
      },
    ],
    config: {
      systemInstruction:
        'Sei un esperto di pricing per un marketplace italiano di abbigliamento second-hand. ' +
        'Stima un prezzo di vendita realistico in euro. Usa solo i dati forniti e la foto.',
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.2,
    },
  });
  return JSON.parse(res.text);
}

async function valuate() {
  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`→ ${model} (tentativo ${attempt}/${MAX_ATTEMPTS})`);
        return { model, data: await callModel(model) };
      } catch (err) {
        const status = getStatus(err);
        console.warn(`  errore ${status ?? '?'}`);
        if (!RETRYABLE.includes(status)) break; // es. 404: inutile riprovare, passa al fallback
        if (attempt < MAX_ATTEMPTS) await sleep(2000 * attempt);
      }
    }
  }
  throw new Error('Tutti i modelli non disponibili');
}

try {
  const { model, data } = await valuate();
  const ok = data.range.min <= data.suggested_price && data.suggested_price <= data.range.max;
  console.log(`\nRisposta da ${model}:\n`);
  console.log(JSON.stringify(data, null, 2));
  console.log(ok ? '\nOK: prezzo dentro il range' : '\nKO: prezzo fuori range');
} catch (err) {
  console.error('Errore:', err.message);
  process.exit(1);
}
