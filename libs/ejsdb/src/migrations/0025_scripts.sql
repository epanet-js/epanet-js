CREATE TABLE scripts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,
  api_version INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
