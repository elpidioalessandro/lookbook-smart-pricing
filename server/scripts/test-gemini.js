// server/scripts/test-gemini.js
// Uso: node scripts/test-gemini.js ./foto-test.jpg
// Prerequisiti: npm i @google/genai dotenv  |  "type": "module" in package.json
// .env: GEMINI_API_KEY=...  GEMINI_MODEL=<id del modello Flash copiato da AI Studio>

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

try {
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,
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

  const data = JSON.parse(res.text);

  // Controllo minimo di coerenza: il prezzo deve stare dentro il range
  const ok =
    data.range.min <= data.suggested_price && data.suggested_price <= data.range.max;

  console.log(JSON.stringify(data, null, 2));
  console.log(ok ? '\nOK: prezzo dentro il range' : '\nKO: prezzo fuori range');
} catch (err) {
  if (err.status === 429) console.error('Rate limit del free tier: riprova tra un minuto');
  else console.error('Errore:', err.message);
  process.exit(1);
}
