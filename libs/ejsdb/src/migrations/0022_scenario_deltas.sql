CREATE TABLE scenario_deltas (
  scenario_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  delta BLOB NOT NULL
);
