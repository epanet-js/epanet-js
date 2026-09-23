type DB = {
  exec: (
    sql: string,
    opts?: {
      bind?: unknown[];
      returnValue?: "this" | "resultRows" | "saveSql";
      rowMode?: "array" | "object";
    },
  ) => unknown;
};

// Slot 0022 shipped twice. The first deploy created `scenario_deltas`; the second
// rewrote the same slot to create `scenarios` with a `simulation_settings` column,
// on the assumption that no file could carry the first shape because the feature
// flag was off everywhere. That assumption was wrong: 0022 creates its table
// regardless of the flag, so every project saved against the first deploy sits at
// user_version 22 with `scenario_deltas`, and the runner never replays 22 for it.
// Those files reach the scenarios queries with no `scenarios` table at all.
//
// Only the table name and the added nullable column differ between the two shapes —
// the delta blobs are identical — so a rename carries the rows across untouched.
//
// This migration asserts the end state rather than assuming a starting one, which is
// the part 0022 got wrong: whichever of the two shapes a file arrives in, and even in
// neither, it leaves with the same `scenarios` schema.
const SCENARIOS_TABLE = `
CREATE TABLE scenarios (
  scenario_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  delta BLOB NOT NULL,
  simulation_settings TEXT
);
`;

const hasTable = (db: DB, name: string): boolean => {
  const rows = db.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    { bind: [name], returnValue: "resultRows" },
  ) as unknown[][];
  return rows.length > 0;
};

const renameScenarioDeltasToScenarios = (db: DB): void => {
  if (hasTable(db, "scenarios")) return;

  if (hasTable(db, "scenario_deltas")) {
    db.exec("ALTER TABLE scenario_deltas RENAME TO scenarios");
    db.exec("ALTER TABLE scenarios ADD COLUMN simulation_settings TEXT");
    return;
  }

  db.exec(SCENARIOS_TABLE);
};

export default renameScenarioDeltasToScenarios;
