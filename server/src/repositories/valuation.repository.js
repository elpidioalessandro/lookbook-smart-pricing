import { pool } from '../config/db.js';

export async function insertValuation({ item, image, imageSha256, data, meta }) {
  const { rows } = await pool.query(
    `INSERT INTO valuations (
       category, brand, condition, image_sha256, image_mime, image_bytes,
       suggested_price, price_min, price_max, input_matches, detected_item, response,
       model, attempts, latency_ms
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id, created_at`,
    [
      item.category, item.brand, item.condition, imageSha256, image.mimetype, image.size,
      data.suggested_price, data.range.min, data.range.max,
      data.input_consistency.matches, data.input_consistency.detected_item, data,
      meta.model, meta.attempts, meta.latency_ms,
    ],
  );
  return rows[0];
}

export async function listValuations(limit = 20) {
  const { rows } = await pool.query(
    `SELECT id, created_at, category, brand, condition,
            suggested_price::float AS suggested_price,
            price_min::float AS price_min, price_max::float AS price_max,
            input_matches, detected_item, model, latency_ms
       FROM valuations
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function getValuationById(id) {
  const { rows } = await pool.query(
    `SELECT id, created_at, category, brand, condition, response, model, attempts, latency_ms
       FROM valuations WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
