import type { ChangeRecord, DecodedChangeSet } from "./types";

export type ChangeSetMigration = {
  to: number;
  describe: string;
  migrate: (decoded: DecodedChangeSet) => {
    name: string;
    records: ChangeRecord[];
  };
};

// Permanent and append-only. See ../AGENTS.md before adding an entry.
export const migrations: ChangeSetMigration[] = [];

export const CURRENT_VERSION = migrations.reduce(
  (version, migration) => Math.max(version, migration.to),
  1,
);
