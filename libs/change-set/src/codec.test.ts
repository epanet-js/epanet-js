import { describe, it, expect } from "vitest";
import { ChangeSet, squash } from "./change-set";
import type { ChangeRecord } from "./types";

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

  it("keeps string-keyed entities apart from numeric ones", () => {
    const cs = ChangeSet.of("changeControls", [
      {
        entity: "control",
        id: "abc123",
        kind: "create",
        before: {},
        after: { $value: { type: "timed-setting" } },
      },
    ]);
    expect(cs.records[0].id).toBe("abc123");
    expect(cs.records[0].after.$value).toEqual({ type: "timed-setting" });
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
