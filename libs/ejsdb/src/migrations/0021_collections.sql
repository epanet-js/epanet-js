CREATE TABLE selection_sets (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  assets          BLOB,
  customer_points BLOB
);

ALTER TABLE project ADD COLUMN bookmarks TEXT DEFAULT NULL;
