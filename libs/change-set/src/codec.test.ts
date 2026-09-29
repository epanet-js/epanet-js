import { describe, it, expect } from "vitest";
import { ChangeSet, invert, squash, squashOnto } from "./change-set";
import { effective, effectiveChanges, effectiveSide } from "./direction";
import type { ChangeKind, ChangeRecord } from "./types";

describe("codec", () => {
  it("round-trips scalars, nulls and absents", () => {
    const records: ChangeRecord[] = [
      {
        entity: "pipe",
        id: 11,
        kind: "update",
        before: {
          diameter: 200,
          label: "P1",
          isActive: true,
          minorLoss: undefined,
          roughness: null,
        },
        after: {
          diameter: 300,
          label: "P2",
          isActive: false,
          minorLoss: 5,
          roughness: 130,
        },
      },
    ];
    const cs = ChangeSet.of("changeProperty", records);
    const back = cs.records[0];
    expect(cs.name).toBe("changeProperty");
    expect(back.before).toEqual(records[0].before);
    expect(back.after).toEqual(records[0].after);
    expect("minorLoss" in back.before).toBe(true);
    expect(back.before.minorLoss).toBeUndefined();
    expect(back.before.roughness).toBeNull();
  });

  it("round-trips structured values", () => {
    const cs = ChangeSet.of("moveNode", [
      {
        entity: "junction",
        id: 3,
        kind: "update",
        before: { coordinates: [1, 2] },
        after: { coordinates: [3, 4] },
      },
      {
        entity: "pipe",
        id: 9,
        kind: "update",
        before: {
          coordinates: [
            [1, 2],
            [5, 6],
          ],
        },
        after: {
          coordinates: [
            [3, 4],
            [5, 6],
          ],
        },
      },
    ]);
    expect(cs.records[0].after.coordinates).toEqual([3, 4]);
    expect(cs.records[1].before.coordinates).toEqual([
      [1, 2],
      [5, 6],
    ]);
  });

  it("collapses a uniform column on the wire", () => {
    const many = (n: number, uniform: boolean): ChangeRecord[] =>
      Array.from({ length: n }, (_, i) => ({
        entity: "pipe" as const,
        id: i + 1,
        kind: "update" as const,
        before: { diameter: 100 + i },
        after: { diameter: uniform ? 300 : 300 + i },
      }));
    const uniform = ChangeSet.of("bulk", many(500, true));
    const varied = ChangeSet.of("bulk", many(500, false));
    expect(uniform.byteLength).toBeLessThan(varied.byteLength);
    expect(uniform.records[499].after.diameter).toBe(300);
    expect(uniform.records[499].before.diameter).toBe(599);
  });

  it("round-trips a whole collection in one record", () => {
    const cs = ChangeSet.of("changeControls", [
      {
        entity: "allControls",
        id: 0,
        kind: "update",
        before: { $value: [] },
        after: { $value: [{ id: "abc123", type: "timed-setting" }] },
      },
      {
        entity: "customAttributesDefinition",
        id: 0,
        kind: "update",
        before: { $value: {} },
        after: { $value: { "pipe/1": { label: "DIAMETER" } } },
      },
    ]);

    expect(cs.records).toHaveLength(2);
    expect(cs.records[0].after.$value).toEqual([
      { id: "abc123", type: "timed-setting" },
    ]);
    expect(cs.records[0].before.$value).toEqual([]);
    expect(cs.records[1].after.$value).toEqual({
      "pipe/1": { label: "DIAMETER" },
    });
  });
});

describe("squash", () => {
  const cs = (name: string, records: ChangeRecord[]) =>
    ChangeSet.of(name, records);

  it("keeps the first before and the last after", () => {
    const a = cs("a", [
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 100 },
        after: { diameter: 200 },
      },
    ]);
    const b = cs("b", [
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 200 },
        after: { diameter: 300 },
      },
    ]);
    const s = squash("scenario", [a, b]);
    expect(s.records).toHaveLength(1);
    expect(s.records[0].before.diameter).toBe(100);
    expect(s.records[0].after.diameter).toBe(300);
  });

  it("update then delete restores the pre-update value", () => {
    const a = cs("a", [
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 100 },
        after: { diameter: 200 },
      },
    ]);
    const b = cs("b", [
      {
        entity: "pipe",
        id: 1,
        kind: "delete",
        before: { diameter: 200, label: "P1" },
        after: {},
      },
    ]);
    const s = squash("scenario", [a, b]);
    expect(s.records[0].kind).toBe("delete");
    expect(s.records[0].before.diameter).toBe(100);
    expect(s.records[0].before.label).toBe("P1");
  });

  it("create then delete cancels out", () => {
    const a = cs("a", [
      {
        entity: "pipe",
        id: 1,
        kind: "create",
        before: {},
        after: { diameter: 100 },
      },
    ]);
    const b = cs("b", [
      {
        entity: "pipe",
        id: 1,
        kind: "delete",
        before: { diameter: 100 },
        after: {},
      },
    ]);
    expect(squash("scenario", [a, b]).records).toHaveLength(0);
  });

  it("create then update stays a create", () => {
    const a = cs("a", [
      {
        entity: "pipe",
        id: 1,
        kind: "create",
        before: {},
        after: { diameter: 100 },
      },
    ]);
    const b = cs("b", [
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 100 },
        after: { diameter: 250 },
      },
    ]);
    const s = squash("scenario", [a, b]);
    expect(s.records[0].kind).toBe("create");
    expect(s.records[0].after.diameter).toBe(250);
    expect(s.records[0].before).toEqual({});
  });

  it("delete then create reads as an update", () => {
    const a = cs("a", [
      {
        entity: "pipe",
        id: 1,
        kind: "delete",
        before: { diameter: 100 },
        after: {},
      },
    ]);
    const b = cs("b", [
      {
        entity: "pipe",
        id: 1,
        kind: "create",
        before: {},
        after: { diameter: 400 },
      },
    ]);
    const s = squash("scenario", [a, b]);
    expect(s.records[0].kind).toBe("update");
    expect(s.records[0].before.diameter).toBe(100);
    expect(s.records[0].after.diameter).toBe(400);
  });

  it("does not merge entities with different field sets into one column", () => {
    const s = squash("scenario", [
      cs("a", [
        {
          entity: "pipe",
          id: 1,
          kind: "update",
          before: { diameter: 1 },
          after: { diameter: 2 },
        },
      ]),
      cs("b", [
        {
          entity: "pipe",
          id: 2,
          kind: "update",
          before: { roughness: 3 },
          after: { roughness: 4 },
        },
      ]),
    ]);
    const byId = new Map(s.records.map((r) => [r.id, r]));
    expect(Object.keys(byId.get(1)!.after)).toEqual(["diameter"]);
    expect(Object.keys(byId.get(2)!.after)).toEqual(["roughness"]);
  });
});

describe("one record per entity", () => {
  it("merges a put and a patch on the same asset, so undo is exact", () => {
    // What the old applier needed `assertNoPutPatchOverlap` to catch.
    const cs = ChangeSet.of("compound", [
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 100 },
        after: { diameter: 200 },
      },
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 200 },
        after: { diameter: 300 },
      },
    ]);
    expect(cs.records).toHaveLength(1);
    expect(cs.records[0].before.diameter).toBe(100);
    expect(cs.records[0].after.diameter).toBe(300);
  });

  it("merges a create followed by an update of the same asset", () => {
    const cs = ChangeSet.of("compound", [
      {
        entity: "junction",
        id: 7,
        kind: "create",
        before: {},
        after: { label: "J7", elevation: 1 },
      },
      {
        entity: "junction",
        id: 7,
        kind: "update",
        before: { elevation: 1 },
        after: { elevation: 9 },
      },
    ]);
    expect(cs.records).toHaveLength(1);
    expect(cs.records[0].kind).toBe("create");
    expect(cs.records[0].after).toEqual({ label: "J7", elevation: 9 });
  });

  it("leaves distinct entities alone", () => {
    const cs = ChangeSet.of("bulk", [
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 1 },
        after: { diameter: 2 },
      },
      {
        entity: "pipe",
        id: 2,
        kind: "update",
        before: { diameter: 3 },
        after: { diameter: 4 },
      },
    ]);
    expect(cs.records).toHaveLength(2);
  });
});

describe("invert", () => {
  const cs = (records: ChangeRecord[]) => ChangeSet.of("edit", records);

  it("agrees with reading the reverse column", () => {
    const kinds: ChangeKind[] = ["create", "update", "delete"];

    for (const kind of kinds) {
      const record: ChangeRecord = {
        entity: "pipe",
        id: 1,
        kind,
        before: kind === "create" ? {} : { diameter: 100 },
        after: kind === "delete" ? {} : { diameter: 200 },
      };

      const inverted = invert(cs([record])).records[0];

      expect(inverted.kind).toBe(effective(record, "reverse").kind);
      expect(inverted.before).toEqual(record.after);
      expect(inverted.after).toEqual(record.before);
    }
  });

  it("cancels an update when squashed onto it", () => {
    const change = cs([
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 100 },
        after: { diameter: 200 },
      },
    ]);

    const folded = squash("", [change, invert(change)]);

    expect(folded.records[0].before.diameter).toBe(100);
    expect(folded.records[0].after.diameter).toBe(100);
  });

  it("cancels a create when squashed onto it", () => {
    const change = cs([
      {
        entity: "pipe",
        id: 1,
        kind: "create",
        before: {},
        after: { diameter: 200 },
      },
    ]);

    expect(squash("", [change, invert(change)]).records).toEqual([]);
  });

  it("keeps the version it was given", () => {
    const change = ChangeSet.atVersion(1, "edit", [
      {
        entity: "pipe",
        id: 1,
        kind: "update",
        before: { diameter: 100 },
        after: { diameter: 200 },
      },
    ]);

    expect(invert(change).version).toBe(1);
  });
});

describe("entries", () => {
  const records: ChangeRecord[] = [
    {
      entity: "junction",
      id: 1,
      kind: "create",
      before: {},
      after: { label: "J1", elevation: 10 },
    },
    {
      entity: "junction",
      id: 2,
      kind: "create",
      before: {},
      after: { label: "J2", elevation: 10 },
    },
    {
      entity: "pipe",
      id: 3,
      kind: "update",
      before: { label: "P1" },
      after: { label: "P2" },
    },
    {
      entity: "pipe",
      id: 4,
      kind: "update",
      before: { diameter: 100 },
      after: { diameter: 200 },
    },
    {
      entity: "tank",
      id: 5,
      kind: "update",
      before: { label: "T1" },
      after: { label: null },
    },
    {
      entity: "valve",
      id: 6,
      kind: "delete",
      before: { label: "V1" },
      after: {},
    },
    {
      entity: "pump",
      id: 7,
      kind: "create",
      before: {},
      after: { label: "PU" },
    },
    {
      entity: "pump",
      id: 8,
      kind: "create",
      before: {},
      after: { label: "PU" },
    },
  ];

  const stored = () => ChangeSet.fromBytes(ChangeSet.of("edit", records).bytes);
  const decoded = () => ChangeSet.of("edit", records).records;

  it("lists every entity with its stored kind", () => {
    const entries = [...stored().entries()].map(({ entity, kind, id }) => ({
      entity,
      kind,
      id,
    }));

    expect(entries).toEqual(
      decoded().map(({ entity, kind, id }) => ({ entity, kind, id })),
    );
  });

  it("reads one cell from either side", () => {
    const entries = [...stored().entries()];

    expect(entries.map((entry) => entry.get("after", "label"))).toEqual(
      decoded().map((record) => record.after.label),
    );
    expect(entries.map((entry) => entry.get("before", "label"))).toEqual(
      decoded().map((record) => record.before.label),
    );
  });

  it("reads a whole side as the decoded record holds it", () => {
    const entries = [...stored().entries()];

    expect(entries.map((entry) => entry.fields("after"))).toStrictEqual(
      decoded().map((record) => record.after),
    );
    expect(entries.map((entry) => entry.fields("before"))).toStrictEqual(
      decoded().map((record) => record.before),
    );
  });

  it("reads the name without decoding", () => {
    expect(stored().name).toBe("edit");
  });

  it("picks the side effective reads, in both directions", () => {
    for (const record of decoded()) {
      for (const direction of ["forward", "reverse"] as const) {
        const { kind, side } = effectiveSide(record.kind, direction);
        expect({ kind, fields: record[side] }).toStrictEqual(
          effective(record, direction),
        );
      }
    }
  });

  it("reads each entity's effective change, in both directions", () => {
    for (const direction of ["forward", "reverse"] as const) {
      const changes = [...effectiveChanges(stored(), direction)].map(
        ({ entity, id, change }) => ({
          entity,
          id,
          change: { kind: change.kind, fields: change.fields },
        }),
      );

      expect(changes).toStrictEqual(
        decoded().map((record) => ({
          entity: record.entity,
          id: record.id,
          change: effective(record, direction),
        })),
      );
    }
  });

  it("counts entities", () => {
    expect(stored().size).toBe(records.length);
    expect(ChangeSet.fromBytes(ChangeSet.empty().bytes).size).toBe(0);
  });
});

describe("squashOnto", () => {
  const cs = (records: ChangeRecord[]) => ChangeSet.of("edit", records);

  const pipe = (
    id: number,
    kind: ChangeKind,
    before: ChangeRecord["before"],
    after: ChangeRecord["after"],
  ): ChangeRecord => ({ entity: "pipe", id, kind, before, after });

  const untouched: ChangeRecord[] = [
    pipe(10, "update", { diameter: 100 }, { diameter: 150 }),
    pipe(11, "update", { diameter: 100 }, { diameter: 150 }),
    pipe(12, "update", { diameter: 100 }, { diameter: 150 }),
    {
      entity: "junction",
      id: 20,
      kind: "create",
      before: {},
      after: {
        label: "J20",
        coordinates: [1, 2],
        elevation: null,
        emitter: undefined,
        isActive: true,
      },
    },
    {
      entity: "junctionDemand",
      id: 20,
      kind: "update",
      before: { $value: [] },
      after: { $value: [{ baseDemand: 3, patternId: 1 }] },
    },
  ];

  const stored = (...records: ChangeRecord[]) =>
    ChangeSet.fromBytes(cs([...untouched, ...records]).bytes);

  const byEntity = (records: ChangeRecord[]) =>
    [...records].sort((a, b) =>
      `${a.entity}|${a.id}`.localeCompare(`${b.entity}|${b.id}`),
    );

  const expectSameAsSquash = (base: ChangeSet, change: ChangeSet) => {
    for (const direction of ["forward", "reverse"] as const) {
      const expected = squash("", [
        base,
        direction === "forward" ? change : invert(change),
      ]);
      const actual = squashOnto(base, change, direction);

      expect(byEntity(actual.records)).toStrictEqual(
        byEntity(expected.records),
      );
      expect(actual.name).toBe("");
      expect(actual.version).toBe(expected.version);
    }
  };

  it.each([
    [
      "keeps the first before and the last after",
      [pipe(1, "update", { diameter: 100 }, { diameter: 200 })],
      [pipe(1, "update", { diameter: 200 }, { diameter: 300 })],
    ],
    [
      "update then delete restores the pre-update value",
      [pipe(1, "update", { diameter: 100 }, { diameter: 200 })],
      [pipe(1, "delete", { diameter: 200, label: "P1" }, {})],
    ],
    [
      "create then delete cancels out",
      [pipe(1, "create", {}, { diameter: 100 })],
      [pipe(1, "delete", { diameter: 100 }, {})],
    ],
    [
      "create then update stays a create",
      [pipe(1, "create", {}, { diameter: 100 })],
      [pipe(1, "update", { diameter: 100 }, { diameter: 250 })],
    ],
    [
      "delete then create reads as an update",
      [pipe(1, "delete", { diameter: 100 }, {})],
      [pipe(1, "create", {}, { diameter: 400 })],
    ],
    [
      "does not merge entities with different field sets",
      [pipe(1, "update", { diameter: 1 }, { diameter: 2 })],
      [pipe(2, "update", { roughness: 3 }, { roughness: 4 })],
    ],
    [
      "adds an entity the stored set does not hold",
      [],
      [pipe(1, "create", {}, { diameter: 100, label: "P1" })],
    ],
  ] as [string, ChangeRecord[], ChangeRecord[]][])("%s", (_, base, change) => {
    expectSameAsSquash(stored(...base), cs(change));
  });

  it("keeps the rest of a collapsed column when one entity changes", () => {
    const change = cs([
      pipe(11, "update", { diameter: 150 }, { diameter: 175 }),
    ]);

    expectSameAsSquash(stored(), change);
    const byId = new Map(
      squashOnto(stored(), change, "forward").records.map((record) => [
        `${record.entity}|${record.id}`,
        record,
      ]),
    );
    expect(byId.get("pipe|10")!.after.diameter).toBe(150);
    expect(byId.get("pipe|11")!.after.diameter).toBe(175);
    expect(byId.get("pipe|12")!.after.diameter).toBe(150);
  });

  it("keeps both values when a field meets a value of another type", () => {
    const change = cs([
      pipe(13, "update", { diameter: 100 }, { diameter: "wide" }),
    ]);

    expectSameAsSquash(stored(), change);
    const after = squashOnto(stored(), change, "forward").records.find(
      (record) => record.entity === "pipe" && record.id === 13,
    )!.after;
    expect(after.diameter).toBe("wide");
  });

  it("moves a merged entity to the op matching its new field set", () => {
    const change = cs([pipe(10, "update", { roughness: 1 }, { roughness: 2 })]);

    expectSameAsSquash(stored(), change);
  });

  it("carries every untouched entity across exactly", () => {
    const change = cs([pipe(1, "create", {}, { diameter: 100 })]);
    const records = byEntity(
      squashOnto(stored(), change, "forward").records,
    ).filter((record) => !(record.entity === "pipe" && record.id === 1));

    expect(records).toStrictEqual(byEntity(stored().records));
  });
});
