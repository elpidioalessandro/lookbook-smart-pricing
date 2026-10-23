import 'dotenv/config';

const required = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'DATABASE_URL'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Variabili mancanti nel .env: ${missing.join(', ')}`);
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY,
  models: [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter(Boolean),
  // Lista separata da virgole, es. "http://localhost:5173,https://lookbook.netlify.app"
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL,
};
