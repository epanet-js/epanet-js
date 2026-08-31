import { LabelManager } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import type { Curves, ICurve } from "@epanet-js/hydraulic-model";
import { mergeCurves } from "./merge-curves";
import type { ParsedCurve } from "./parse-curves-file";

const curvesOf = (...items: ICurve[]): Curves =>
  new Map(items.map((c) => [c.id, c]));

const merge = (existing: Curves, incoming: ParsedCurve[]) => {
  const labelManager = new LabelManager();
  for (const curve of existing.values()) {
    labelManager.register(curve.label, "curve", curve.id);
  }
  return mergeCurves(existing, incoming, {
    labelManager,
    idGenerator: new ConsecutiveIdsGenerator(Math.max(0, ...existing.keys())),
  });
};

describe("mergeCurves", () => {
  it("appends a curve whose label is not in the model", () => {
    const existing = curvesOf({
      id: 1,
      label: "C1",
      type: "volume",
      points: [{ x: 0, y: 1 }],
    });

    const { curves, counts } = merge(existing, [
      { label: "NEW", type: "volume", points: [{ x: 2, y: 3 }] },
    ]);

    expect(curves.size).toEqual(2);
    expect(counts).toEqual({
      added: 1,
      updated: 0,
      identical: 0,
      notModified: 1,
    });
  });

  it("replaces a same-type match in place, keeping its id", () => {
    const existing = curvesOf({
      id: 7,
      label: "C1",
      type: "volume",
      points: [{ x: 0, y: 1 }],
    });

    const { curves, counts } = merge(existing, [
      { label: "C1", type: "volume", points: [{ x: 9, y: 9 }] },
    ]);

    expect(curves.get(7)?.points).toEqual([{ x: 9, y: 9 }]);
    expect(counts.updated).toEqual(1);
  });

  it("matches labels case-insensitively", () => {
    const existing = curvesOf({
      id: 1,
      label: "C1",
      type: "volume",
      points: [{ x: 0, y: 1 }],
    });

    const { curves, counts } = merge(existing, [
      { label: "c1", type: "volume", points: [{ x: 2, y: 3 }] },
    ]);

    expect(curves.size).toEqual(1);
    expect(counts.updated).toEqual(1);
  });

  it("promotes an uncategorized curve to the file's type", () => {
    const existing = curvesOf({ id: 1, label: "C1", points: [{ x: 0, y: 1 }] });

    const { curves } = merge(existing, [
      { label: "C1", type: "valve", points: [{ x: 0, y: 1 }] },
    ]);

    expect(curves.get(1)?.type).toEqual("valve");
  });

  it("keeps the model's type when the file leaves it blank", () => {
    const existing = curvesOf({
      id: 1,
      label: "C1",
      type: "volume",
      points: [{ x: 0, y: 1 }],
    });

    const { curves } = merge(existing, [
      { label: "C1", points: [{ x: 5, y: 5 }] },
    ]);

    expect(curves.get(1)).toEqual({
      id: 1,
      label: "C1",
      type: "volume",
      points: [{ x: 5, y: 5 }],
    });
  });

  it("duplicates under a fresh label when two explicit types clash", () => {
    const existing = curvesOf({
      id: 1,
      label: "C1",
      type: "volume",
      points: [{ x: 0, y: 1 }],
    });

    const { curves, counts } = merge(existing, [
      { label: "C1", type: "valve", points: [{ x: 2, y: 3 }] },
    ]);

    expect(curves.get(1)?.type).toEqual("volume");
    const appended = [...curves.values()].find((c) => c.id !== 1)!;
    expect(appended.label).not.toEqual("C1");
    expect(appended.type).toEqual("valve");
    expect(counts.added).toEqual(1);
  });

  it("counts an unchanged match as identical rather than updated", () => {
    const existing = curvesOf({
      id: 1,
      label: "C1",
      type: "volume",
      points: [
        { x: 0, y: 1 },
        { x: 2, y: 3 },
      ],
    });

    const { counts } = merge(existing, [
      {
        label: "C1",
        type: "volume",
        points: [
          { x: 0, y: 1 },
          { x: 2, y: 3 },
        ],
      },
    ]);

    expect(counts).toEqual({
      added: 0,
      updated: 0,
      identical: 1,
      notModified: 0,
    });
  });

  it("never deletes a curve the file does not mention", () => {
    const existing = curvesOf(
      { id: 1, label: "KEEP", type: "volume", points: [{ x: 0, y: 1 }] },
      { id: 2, label: "ALSO_KEEP", type: "valve", points: [{ x: 0, y: 1 }] },
    );

    const { curves, counts } = merge(existing, [
      { label: "KEEP", type: "volume", points: [{ x: 5, y: 5 }] },
    ]);

    expect(curves.get(2)?.points).toEqual([{ x: 0, y: 1 }]);
    expect(counts.notModified).toEqual(1);
  });
});
