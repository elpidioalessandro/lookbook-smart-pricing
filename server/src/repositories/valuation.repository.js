import { pool } from '../config/db.js';

// Verso l'esterno esce solo public_id (UUID casuale): l'id SERIAL interno non viene mai esposto.

export async function insertValuation({ item, image, imageSha256, data, meta, clientId }) {
  const { rows } = await pool.query(
    `INSERT INTO valuations (
       category, brand, condition, image_sha256, image_mime, image_bytes,
       suggested_price, price_min, price_max, input_matches, detected_item, response,
       model, attempts, latency_ms, client_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING public_id AS id, created_at`,
    [
      item.category, item.brand, item.condition, imageSha256, image.mimetype, image.size,
      data.suggested_price, data.range.min, data.range.max,
      data.input_consistency.matches, data.input_consistency.detected_item, data,
      meta.model, meta.attempts, meta.latency_ms, clientId,
    ],
  );
  return rows[0];
}

// Storico personale: solo le valutazioni fatte da questo browser
export async function listValuations(clientId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT public_id AS id, created_at, category, brand, condition,
            suggested_price::float AS suggested_price,
            price_min::float AS price_min, price_max::float AS price_max,
            input_matches, detected_item, model, latency_ms
       FROM valuations
      WHERE client_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [clientId, limit],
  );
  return rows;
}

export async function getValuationById(publicId) {
  const { rows } = await pool.query(
    `SELECT public_id AS id, created_at, category, brand, condition, response, model, attempts, latency_ms
       FROM valuations WHERE public_id = $1`,
    [publicId],
  );
  return rows[0] ?? null;
}
