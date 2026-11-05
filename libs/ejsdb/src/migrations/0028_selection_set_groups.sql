CREATE TABLE selection_set_groups (
  id        TEXT PRIMARY KEY,
  label     TEXT NOT NULL,
  parent_id TEXT
);

ALTER TABLE selection_sets ADD COLUMN group_id TEXT;
