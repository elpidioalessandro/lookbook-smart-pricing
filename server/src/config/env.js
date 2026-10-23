import 'dotenv/config';

const required = ['GEMINI_API_KEY', 'GEMINI_MODEL'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Variabili mancanti nel .env: ${missing.join(', ')}`);
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY,
  models: [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter(Boolean),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
