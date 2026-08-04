import { Pipe } from "@epanet-js/hydraulic-model";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import {
  buildRoughnessInferrer,
  effectiveRoughness,
  findRoughness,
  inferredRoughness,
} from "./infer-roughness";

const CURRENT_YEAR = new Date().getFullYear();

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
    expect(findRoughness(entries, 11)).toBe(100);
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
    expect(findRoughness(entries, 15)).toBe(100);
    expect(findRoughness(entries, 25)).toBe(200);
    expect(findRoughness(entries, 50)).toBe(300);
  });

  it("returns null for an empty entry list", () => {
    expect(findRoughness([], 10)).toBeNull();
  });
});

describe("inferredRoughness", () => {
  const castIron = (entries: PipeMaterial["entries"]): PipeMaterial[] => [
    { label: "Cast Iron", entries },
  ];

  it("infers from the age bracket matching the pipe age", () => {
    const materials = castIron([
      { age: 0, roughness: 100 },
      { age: 20, roughness: 200 },
    ]);
    const pipe = makePipe({ material: "Cast Iron", year: CURRENT_YEAR - 25 });

    expect(inferredRoughness(pipe, materials)).toBe(200);
  });

  it("infers without a year when the material has a single entry", () => {
    const materials = castIron([{ age: 0, roughness: 120 }]);
    const pipe = makePipe({ material: "Cast Iron" });

    expect(inferredRoughness(pipe, materials)).toBe(120);
  });

  it("does not infer without a year when the material has several entries", () => {
    const materials = castIron([
      { age: 0, roughness: 100 },
      { age: 10, roughness: 120 },
    ]);
    const pipe = makePipe({ material: "Cast Iron" });

    expect(inferredRoughness(pipe, materials)).toBeNull();
  });

  it("does not infer when the pipe has no material", () => {
    const materials = castIron([{ age: 0, roughness: 120 }]);
    const pipe = makePipe({ year: CURRENT_YEAR - 5 });

    expect(inferredRoughness(pipe, materials)).toBeNull();
  });

  it("does not infer when the material is not in the library", () => {
    const materials = castIron([{ age: 0, roughness: 120 }]);
    const pipe = makePipe({ material: "PVC", year: CURRENT_YEAR - 5 });

    expect(inferredRoughness(pipe, materials)).toBeNull();
  });

  it("does not infer when the installation year is out of range", () => {
    const materials = castIron([
      { age: 0, roughness: 100 },
      { age: 10, roughness: 120 },
    ]);

    expect(
      inferredRoughness(
        makePipe({ material: "Cast Iron", year: 999 }),
        materials,
      ),
    ).toBeNull();
    expect(
      inferredRoughness(
        makePipe({ material: "Cast Iron", year: 10000 }),
        materials,
      ),
    ).toBeNull();
    expect(
      inferredRoughness(
        makePipe({ material: "Cast Iron", year: 1995.5 }),
        materials,
      ),
    ).toBeNull();
  });

  it("clamps a future installation year to age 0", () => {
    const materials = castIron([
      { age: 0, roughness: 100 },
      { age: 10, roughness: 120 },
    ]);
    const pipe = makePipe({ material: "Cast Iron", year: CURRENT_YEAR + 5 });

    expect(inferredRoughness(pipe, materials)).toBe(100);
  });

  it("ignores entries with a null age or roughness", () => {
    const materials = castIron([
      { age: null, roughness: null },
      { age: 10, roughness: 120 },
    ]);
    const pipe = makePipe({ material: "Cast Iron", year: CURRENT_YEAR - 5 });

    expect(inferredRoughness(pipe, materials)).toBe(120);
  });

  it("sorts unsorted entries by age", () => {
    const materials = castIron([
      { age: 20, roughness: 200 },
      { age: 0, roughness: 100 },
    ]);
    const pipe = makePipe({ material: "Cast Iron", year: CURRENT_YEAR - 5 });

    expect(inferredRoughness(pipe, materials)).toBe(100);
  });

  it("ignores the roughness already set on the pipe", () => {
    const materials = castIron([{ age: 0, roughness: 120 }]);
    const pipe = makePipe({ material: "Cast Iron", roughness: 80 });

    expect(inferredRoughness(pipe, materials)).toBe(120);
  });

  it("does not infer when the library is empty", () => {
    const pipe = makePipe({ material: "Cast Iron", year: CURRENT_YEAR - 5 });

    expect(inferredRoughness(pipe, [])).toBeNull();
  });
});

describe("effectiveRoughness", () => {
  const materials: PipeMaterial[] = [
    { label: "Cast Iron", entries: [{ age: 0, roughness: 120 }] },
  ];

  it("prefers the value set on the pipe", () => {
    const pipe = makePipe({ material: "Cast Iron", roughness: 80 });

    expect(effectiveRoughness(pipe, materials)).toBe(80);
  });

  it("falls back to the inferred value", () => {
    const pipe = makePipe({ material: "Cast Iron" });

    expect(effectiveRoughness(pipe, materials)).toBe(120);
  });

  it("stays null when nothing can be inferred", () => {
    const pipe = makePipe({ material: "PVC" });

    expect(effectiveRoughness(pipe, materials)).toBeNull();
  });
});

describe("buildRoughnessInferrer", () => {
  const materials: PipeMaterial[] = [
    { label: "Cast Iron", entries: [{ age: 0, roughness: 120 }] },
  ];

  it("infers when enabled, ignoring the value stored on the pipe", () => {
    const infer = buildRoughnessInferrer(materials, { enabled: true });

    expect(infer(makePipe({ material: "Cast Iron" }))).toBe(120);
    expect(infer(makePipe({ material: "Cast Iron", roughness: 80 }))).toBe(120);
  });

  it("infers nothing when disabled", () => {
    const infer = buildRoughnessInferrer(materials, { enabled: false });

    expect(infer(makePipe({ material: "Cast Iron" }))).toBeNull();
    expect(
      infer(makePipe({ material: "Cast Iron", roughness: 80 })),
    ).toBeNull();
  });
});

const makePipe = (props: {
  material?: string;
  year?: number;
  roughness?: number | null;
}): Pipe =>
  new Pipe(
    1,
    [
      [0, 0],
      [1, 1],
    ],
    {
      type: "pipe",
      label: "P1",
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
