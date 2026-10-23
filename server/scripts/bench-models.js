// server/scripts/bench-models.js
// Uso: node scripts/bench-models.js ./foto-small.jpg
import 'dotenv/config';
import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';

const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const TIMEOUT_MS = 60000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const data = fs.readFileSync(process.argv[2] || './foto-small.jpg').toString('base64');

for (const model of MODELS) {
  const t0 = Date.now();
  try {
    const call = ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: 'image/jpeg', data } },
        { text: 'Stima in euro il prezzo second-hand di questo capo. Rispondi in JSON: {"price": number}' },
      ] }],
      config: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 60s')), TIMEOUT_MS));
    const res = await Promise.race([call, timeout]);
    console.log(`${model.padEnd(24)} ${String(Date.now() - t0).padStart(6)} ms  ${res.text.trim()}`);
  } catch (err) {
    const msg = err.message.match(/"code":(\d+)/)?.[1] ?? err.message;
    console.log(`${model.padEnd(24)} ${String(Date.now() - t0).padStart(6)} ms  ERRORE ${msg}`);
  }
}
