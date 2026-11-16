CREATE TABLE map_themes (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spec TEXT NOT NULL
);

ALTER TABLE project ADD COLUMN active_map_theme_id TEXT DEFAULT NULL;
