import { ChangeSet } from "./change-set";
import type { DecodedChangeSet } from "./types";
import {
  CURRENT_VERSION,
  migrations,
  type ChangeSetMigration,
} from "./versioning";

export class ChangeSetVersionError extends Error {
  readonly storedVersion: number;

  constructor(message: string, storedVersion: number) {
    super(message);
    this.name = "ChangeSetVersionError";
    this.storedVersion = storedVersion;
  }
}

export const isOutdated = (changeSet: ChangeSet): boolean =>
  changeSet.version < CURRENT_VERSION;

const stepsFrom = (
  from: number,
  chain: readonly ChangeSetMigration[],
): ChangeSetMigration[] => {
  const steps = chain
    .filter((migration) => migration.to > from)
    .sort((a, b) => a.to - b.to);

  let expected = from + 1;
  for (const step of steps) {
    if (step.to !== expected) {
      throw new ChangeSetVersionError(
        `No change-set migration to version ${expected}`,
        from,
      );
    }
    expected += 1;
  }
  return steps;
};

export const migrateChangeSet = (changeSet: ChangeSet): ChangeSet =>
  migrateWith(changeSet, migrations, CURRENT_VERSION);

// The chain and target are arguments so tests can drive an unshipped chain.
export const migrateWith = (
  changeSet: ChangeSet,
  chain: readonly ChangeSetMigration[],
  targetVersion: number,
): ChangeSet => {
  const from = changeSet.version;
  if (from === targetVersion) return changeSet;

  if (from > targetVersion) {
    throw new ChangeSetVersionError(
      `Change set was written at version ${from}, this build reads ${targetVersion}`,
      from,
    );
  }

  let decoded: DecodedChangeSet = changeSet.read();
  for (const step of stepsFrom(from, chain)) {
    const { name, records } = step.migrate(decoded);
    decoded = { name, records, version: step.to };
  }

  return ChangeSet.atVersion(targetVersion, decoded.name, decoded.records);
};
