CREATE TABLE scenarios (
  scenario_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  delta BLOB NOT NULL,
  simulation_settings TEXT
);
