// Crea le tabelle sul database indicato in DATABASE_URL.
// Uso: npm run db:init   (si può rilanciare: usa IF NOT EXISTS)
import fs from 'node:fs';
import { pool } from '../src/config/db.js';

const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM valuations`);
  console.log(`Schema OK. Righe in valuations: ${rows[0].n}`);
} catch (err) {
  console.error('Errore:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
