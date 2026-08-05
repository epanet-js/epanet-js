import { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import { roughnessAssignments } from "./apply-roughness";

const CURRENT_YEAR = new Date().getFullYear();

const toPatches = (assignments: ReturnType<typeof roughnessAssignments>) =>
  assignments.flatMap(({ assetIds, roughness }) =>
    assetIds.map((id) => ({ id, type: "pipe", properties: { roughness } })),
  );

describe("roughnessAssignments", () => {
  it("applies roughness to a pipe matching material and age", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 120 } },
    ]);
  });

  it("skips pipes without a material", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(makePipe(1, { year: CURRENT_YEAR - 5 }));

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("skips pipes without a year when material has multiple entries", () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: 120 },
        ],
      },
    ];
    const model = makeModel(makePipe(1, { material: "Cast Iron" }));

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("applies roughness to pipes without a year when material has a single entry", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 0, roughness: 120 }] },
    ];
    const model = makeModel(makePipe(1, { material: "Cast Iron" }));

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 120 } },
    ]);
  });

  it("applies roughness when the material label differs only by case", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "cast iron", year: CURRENT_YEAR - 5 }),
    );

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 120 } },
    ]);
  });

  it("skips pipes whose material is not in the library", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "PVC", year: CURRENT_YEAR - 5 }),
    );

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([]);
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

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 100 } },
      { id: 2, type: "pipe", properties: { roughness: 100 } },
      { id: 3, type: "pipe", properties: { roughness: 200 } },
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

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
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

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
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

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("returns empty patches when there are no pipes", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel();

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("returns empty patches when materials list is empty", () => {
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );

    const assignments = roughnessAssignments(model, []);

    expect(toPatches(assignments)).toEqual([]);
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

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 100 } },
      { id: 2, type: "pipe", properties: { roughness: 100 } },
    ]);
  });

  it("skips pipes that already have a roughness set", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, {
        material: "Cast Iron",
        year: CURRENT_YEAR - 5,
        roughness: 80,
      }),
    );

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("applies roughness to a pipe with age 0", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR }),
    );

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 120 } },
    ]);
  });

  it("skips pipes with an out-of-range or non-integer year", () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: 120 },
        ],
      },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: 999 }),
      makePipe(2, { material: "Cast Iron", year: 10000 }),
      makePipe(3, { material: "Cast Iron", year: 1995.5 }),
    );

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("clamps age to 0 for pipes with a future installation year", () => {
    const materials: PipeMaterial[] = [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: 120 },
        ],
      },
    ];
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR + 5 }),
    );

    const assignments = roughnessAssignments(model, materials);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { roughness: 100 } },
    ]);
  });
});

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
