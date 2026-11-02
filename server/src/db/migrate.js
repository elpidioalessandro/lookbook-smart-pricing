import fs from 'node:fs';
import { pool } from '../config/db.js';

// Applica db/schema.sql (idempotente). Eseguita all'avvio, così il deploy aggiorna il DB da solo.
export async function migrate() {
  const sql = fs.readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}
