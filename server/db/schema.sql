CREATE TYPE difficulty AS ENUM ('easy','medium','hard','extra');

CREATE TABLE IF NOT EXISTS puzzles (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  difficulty difficulty NOT NULL,
  zip_path   TEXT NOT NULL,
  rows       INTEGER,
  cols       INTEGER,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
