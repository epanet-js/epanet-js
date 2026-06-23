import { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import type { PipeMaterial } from "./types";
import { applyRoughnessMoment, findRoughness } from "./apply-roughness";

const CURRENT_YEAR = new Date().getFullYear();

const makePipe = (
  id: number,
  props: { material?: string; year?: number; roughness?: number | null },
): Pipe =>
  new Pipe(
    id,
    [
      [0, 0],
      [1, 1],
    ],
    {
      type: "pipe",
      label: `pipe-${id}`,
      connections: [0, 0],
      initialStatus: "open",
      length: 100,
      diameter: 200,
      minorLoss: 0,
      roughness: props.roughness ?? null,
      material: props.material,
      year: props.year,
      isActive: true,
    },
  );

const makeModel = (...pipes: Pipe[]): HydraulicModel => {
  const assets = new AssetsMap();
  for (const pipe of pipes) {
    assets.set(pipe.id, pipe);
  }
  return { assets } as HydraulicModel;
};

describe("findRoughness", () => {
  it("returns the roughness when pipe age equals the entry age", () => {
    const entries = [{ age: 10, roughness: 100 }];
    expect(findRoughness(entries, 10)).toBe(100);
  });

  it("returns the roughness when pipe age is below the entry age", () => {
    const entries = [{ age: 10, roughness: 100 }];
    expect(findRoughness(entries, 5)).toBe(100);
  });

  it("returns the roughness when pipe age exceeds the only entry age", () => {
    const entries = [{ age: 10, roughness: 100 }];
    expect(findRoughness(entries, 15)).toBe(100);
  });

  it("selects the correct bracket from multiple entries", () => {
    const entries = [
      { age: 10, roughness: 100 },
      { age: 20, roughness: 200 },
    ];
    expect(findRoughness(entries, 5)).toBe(100);
    expect(findRoughness(entries, 10)).toBe(100);
    expect(findRoughness(entries, 11)).toBe(200);
    expect(findRoughness(entries, 20)).toBe(200);
    expect(findRoughness(entries, 30)).toBe(200);
  });

  it("handles three brackets", () => {
    const entries = [
      { age: 10, roughness: 100 },
      { age: 20, roughness: 200 },
      { age: 30, roughness: 300 },
    ];
    expect(findRoughness(entries, 1)).toBe(100);
    expect(findRoughness(entries, 15)).toBe(200);
    expect(findRoughness(entries, 25)).toBe(300);
    expect(findRoughness(entries, 50)).toBe(300);
  });

  it("returns null for an empty entry list", () => {
    expect(findRoughness([], 10)).toBeNull();
  });
});

describe("applyRoughnessMoment", () => {
  it("applies roughness to a pipe matching material and age", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 120 } },
    ]);
  });

  it("skips pipes without a material", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(makePipe(1, { year: CURRENT_YEAR - 5 }));

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("skips pipes without a year", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(makePipe(1, { material: "Cast Iron" }));

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("skips pipes whose material is not in the library", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "PVC", year: CURRENT_YEAR - 5 }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("selects the correct roughness bracket per pipe age", () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: 10, roughness: 100 },
          { age: 20, roughness: 200 },
          { age: 30, roughness: 300 },
        ],
      },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "Cast Iron", year: CURRENT_YEAR - 15 }),
      makePipe(3, { material: "Cast Iron", year: CURRENT_YEAR - 25 }),
      makePipe(4, { material: "Cast Iron", year: CURRENT_YEAR - 50 }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 100 } },
      { id: 2, type: "pipe", properties: { roughness: 200 } },
      { id: 3, type: "pipe", properties: { roughness: 300 } },
      { id: 4, type: "pipe", properties: { roughness: 300 } },
    ]);
  });

  it("handles multiple materials", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 100 }] },
      { label: "PVC", entries: [{ age: 10, roughness: 150 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "PVC", year: CURRENT_YEAR - 5 }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 100 } },
      { id: 2, type: "pipe", properties: { roughness: 150 } },
    ]);
  });

  it("ignores material entries where age or roughness is null", () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: null, roughness: null },
          { age: 10, roughness: 120 },
        ],
      },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 120 } },
    ]);
  });

  it("skips materials with no valid entries", () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [{ age: null, roughness: null }],
      },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("returns empty patches when there are no pipes", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel();

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("returns empty patches when materials list is empty", () => {
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );

    const moment = applyRoughnessMoment(model, []);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("sorts unsorted material entries by age before applying", () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: 20, roughness: 200 },
          { age: 10, roughness: 100 },
        ],
      },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "Cast Iron", year: CURRENT_YEAR - 15 }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 100 } },
      { id: 2, type: "pipe", properties: { roughness: 200 } },
    ]);
  });

  it("applies roughness to a pipe with age 0", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR }),
    );

    const moment = applyRoughnessMoment(model, materials);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 120 } },
    ]);
  });
});
