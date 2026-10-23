-- Storico delle valutazioni: input dell'utente, output dell'LLM e metadati tecnici.
-- L'immagine NON viene salvata: si salva solo l'impronta (sha256) per riconoscere foto identiche.

CREATE TABLE IF NOT EXISTS valuations (
  id               SERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- input
  category         VARCHAR(30)  NOT NULL,
  brand            VARCHAR(50)  NOT NULL,
  condition        VARCHAR(10)  NOT NULL CHECK (condition IN ('nuovo', 'buono', 'usato')),
  image_sha256     CHAR(64)     NOT NULL,
  image_mime       VARCHAR(20)  NOT NULL,
  image_bytes      INTEGER      NOT NULL,

  -- output
  suggested_price  NUMERIC(8,2) NOT NULL,
  price_min        NUMERIC(8,2) NOT NULL,
  price_max        NUMERIC(8,2) NOT NULL,
  input_matches    BOOLEAN      NOT NULL,
  detected_item    TEXT,
  response         JSONB        NOT NULL,   -- risposta completa dell'LLM (motivation, tips, ...)

  -- metadati
  model            VARCHAR(50)  NOT NULL,
  attempts         SMALLINT     NOT NULL,
  latency_ms       INTEGER      NOT NULL,

  CHECK (price_min <= suggested_price AND suggested_price <= price_max)
);

CREATE INDEX IF NOT EXISTS idx_valuations_created_at ON valuations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_valuations_image ON valuations (image_sha256);
