CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat         DOUBLE PRECISION,
  lon         DOUBLE PRECISION,
  audio_path  TEXT NOT NULL,
  image_path  TEXT,
  geo_desc    TEXT
);

CREATE INDEX IF NOT EXISTS reports_created_at_idx
  ON reports (created_at DESC);
