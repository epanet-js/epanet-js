import { describe, it, expect } from "vitest";
import { ChangeSet } from "./change-set";
import { ChangeSetVersionError, migrateWith } from "./migrate";
import type { ChangeRecord } from "./types";
import { CURRENT_VERSION, type ChangeSetMigration } from "./versioning";

const aPipeEdit = (): ChangeRecord[] => [
  {
    entity: "pipe",
    id: 11,
    kind: "update",
    before: { diameter: 200, roughness: null, minorLoss: undefined },
    after: { diameter: 300, roughness: 130, minorLoss: undefined },
  },
];

const step = (
  to: number,
  migrate: ChangeSetMigration["migrate"],
): ChangeSetMigration => ({ to, describe: `to v${to}`, migrate });

const tagName =
  (tag: string): ChangeSetMigration["migrate"] =>
  (decoded) => ({
    name: decoded.name ? `${decoded.name} [${tag}]` : `[${tag}]`,
    records: decoded.records,
  });

const renameKey = <T>(
  bag: Record<string, T>,
  from: string,
  to: string,
): Record<string, T> => {
  if (!(from in bag)) return bag;
  const { [from]: value, ...rest } = bag;
  return { ...rest, [to]: value };
};

const renameField =
  (from: string, to: string): ChangeSetMigration["migrate"] =>
  (decoded) => ({
    name: decoded.name,
    records: decoded.records.map((record) => ({
      ...record,
      before: renameKey(record.before, from, to),
      after: renameKey(record.after, from, to),
    })),
  });

describe("change-set versioning", () => {
  it("stamps what this build writes, and reads a buffer with no stamp as 1", () => {
    expect(ChangeSet.of("changeProperty", aPipeEdit()).version).toBe(
      CURRENT_VERSION,
    );
    // What every change set already in a project file looks like: the field was
    // appended to the table, so its absence reads back as the default.
    expect(ChangeSet.atVersion(1, "changeProperty", aPipeEdit()).version).toBe(
      1,
    );
  });

  it("runs the steps above the stored version, in order", () => {
    const stored = ChangeSet.atVersion(1, "changeProperty", aPipeEdit());
    const chain = [step(3, tagName("c")), step(2, tagName("b"))];

    const migrated = migrateWith(stored, chain, 3);

    expect(migrated.name).toBe("changeProperty [b] [c]");
    expect(migrated.version).toBe(3);
  });

  it("skips the steps a change set is already past", () => {
    const stored = ChangeSet.atVersion(2, "changeProperty", aPipeEdit());
    const chain = [step(2, tagName("b")), step(3, tagName("c"))];

    expect(migrateWith(stored, chain, 3).name).toBe("changeProperty [c]");
  });

  it("leaves a current change set as the bytes it already is", () => {
    const current = ChangeSet.of("changeProperty", aPipeEdit());

    expect(migrateWith(current, [], CURRENT_VERSION)).toBe(current);
  });

  it("carries the records through a rename, on both sides", () => {
    const stored = ChangeSet.atVersion(1, "changeProperty", aPipeEdit());

    const migrated = migrateWith(
      stored,
      [step(2, renameField("roughness", "friction"))],
      2,
    );
    const record = migrated.records[0];

    // Absent stays absent and null stays null across the re-encode: the whole
    // point of Presence is that an undo does not turn one into the other.
    expect(record.before).toEqual({
      diameter: 200,
      friction: null,
      minorLoss: undefined,
    });
    expect(record.after).toEqual({
      diameter: 300,
      friction: 130,
      minorLoss: undefined,
    });
    expect("roughness" in record.after).toBe(false);
  });

  it("refuses a change set written by a newer build", () => {
    const future = ChangeSet.atVersion(9, "changeProperty", aPipeEdit());

    expect(() => migrateWith(future, [], 2)).toThrow(ChangeSetVersionError);
  });

  it("refuses a chain with a hole in it", () => {
    const stored = ChangeSet.atVersion(1, "changeProperty", aPipeEdit());

    expect(() => migrateWith(stored, [step(3, tagName("c"))], 3)).toThrow(
      /version 2/,
    );
  });
});
