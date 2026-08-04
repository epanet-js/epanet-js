import { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import { detectModelMaterials } from "./detect-model-materials";

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_ROUGHNESS = 130;

describe("detectModelMaterials", () => {
  it("returns empty pipeLibrary when model has no pipes", () => {
    const assets = makeAssets();
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.status).toBe("success");
    expect(result.pipeLibrary).toEqual([]);
  });

  it("skips pipes without a material", () => {
    const assets = makeAssets(makePipe(1, { year: CURRENT_YEAR - 5 }));
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary).toEqual([]);
  });

  it("detects a material without a year", () => {
    const assets = makeAssets(makePipe(1, { material: "Cast Iron" }));
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary).toHaveLength(1);
    expect(result.pipeLibrary![0]).toEqual({
      label: "Cast Iron",
      entries: [{ age: 0, roughness: DEFAULT_ROUGHNESS }],
    });
  });

  it("detects a material with a year", () => {
    const assets = makeAssets(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 10 }),
    );
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary).toHaveLength(1);
    expect(result.pipeLibrary![0]).toEqual({
      label: "Cast Iron",
      entries: [
        { age: 0, roughness: DEFAULT_ROUGHNESS },
        { age: 10, roughness: DEFAULT_ROUGHNESS },
      ],
    });
  });

  it("deduplicates pipes with the same material", () => {
    const assets = makeAssets(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary).toHaveLength(1);
    expect(result.pipeLibrary![0].entries).toEqual([
      { age: 0, roughness: DEFAULT_ROUGHNESS },
    ]);
  });

  it("collects distinct age buckets for the same material", () => {
    const assets = makeAssets(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "Cast Iron", year: CURRENT_YEAR - 15 }),
    );
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary).toHaveLength(1);
    expect(result.pipeLibrary![0].entries).toEqual([
      { age: 0, roughness: DEFAULT_ROUGHNESS },
      { age: 10, roughness: DEFAULT_ROUGHNESS },
    ]);
  });

  it("detects multiple materials", () => {
    const assets = makeAssets(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "PVC", year: CURRENT_YEAR - 3 }),
    );
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary).toHaveLength(2);
    expect(result.pipeLibrary![0].label).toBe("Cast Iron");
    expect(result.pipeLibrary![1].label).toBe("PVC");
  });

  it("buckets ages in 10-year steps", () => {
    const ages = [1, 3, 4, 5, 6, 11, 12, 17, 19, 21, 23, 27];
    const assets = makeAssets(
      ...ages.map((age, i) =>
        makePipe(i + 1, { material: "Cast Iron", year: CURRENT_YEAR - age }),
      ),
    );
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary).toHaveLength(1);
    expect(result.pipeLibrary![0].entries).toEqual([
      { age: 0, roughness: DEFAULT_ROUGHNESS },
      { age: 10, roughness: DEFAULT_ROUGHNESS },
      { age: 20, roughness: DEFAULT_ROUGHNESS },
    ]);
  });

  it("sorts results alphabetically by label", () => {
    const model = makeAssets(
      makePipe(1, { material: "PVC" }),
      makePipe(2, { material: "Cast Iron" }),
      makePipe(3, { material: "Ductile Iron" }),
    );
    const labels = detectModelMaterials(
      model,
      DEFAULT_ROUGHNESS,
    ).pipeLibrary!.map((m) => m.label);
    expect(labels).toEqual(["Cast Iron", "Ductile Iron", "PVC"]);
  });

  it("clamps age to 0 for pipes with a future installation year", () => {
    const assets = makeAssets(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR + 5 }),
    );
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary![0].entries).toEqual([
      { age: 0, roughness: DEFAULT_ROUGHNESS },
    ]);
  });

  it("ignores out-of-range or non-integer years when bucketing ages", () => {
    const assets = makeAssets(
      makePipe(1, { material: "Cast Iron", year: 999 }),
      makePipe(2, { material: "Cast Iron", year: 10000 }),
      makePipe(3, { material: "Cast Iron", year: 1995.5 }),
    );
    const result = detectModelMaterials(assets, DEFAULT_ROUGHNESS);
    expect(result.pipeLibrary![0].label).toBe("Cast Iron");
    expect(result.pipeLibrary![0].entries).toEqual([
      { age: 0, roughness: DEFAULT_ROUGHNESS },
    ]);
  });

  it("uses the provided default roughness", () => {
    const assets = makeAssets(makePipe(1, { material: "PVC" }));
    const result = detectModelMaterials(assets, 42);
    expect(result.pipeLibrary![0].entries[0].roughness).toBe(42);
  });
});

const makePipe = (
  id: number,
  props: { material?: string; year?: number },
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
      roughness: null,
      material: props.material,
      year: props.year,
      isActive: true,
    },
  );

const makeAssets = (...pipes: Pipe[]): AssetsMap => {
  const assets = new AssetsMap();
  for (const pipe of pipes) {
    assets.set(pipe.id, pipe);
  }
  return assets;
};
