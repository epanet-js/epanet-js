import { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import { detectModelMaterials } from "./detect-model-materials";

const CURRENT_YEAR = new Date().getFullYear();

describe("detectModelMaterials", () => {
  it("returns empty array when model has no pipes", () => {
    const model = makeModel();
    expect(detectModelMaterials(model)).toEqual([]);
  });

  it("skips pipes without a material", () => {
    const model = makeModel(
      makePipe(1, { year: CURRENT_YEAR - 5 }),
    );
    expect(detectModelMaterials(model)).toEqual([]);
  });

  it("detects a material without a year", () => {
    const model = makeModel(makePipe(1, { material: "Cast Iron" }));
    const result = detectModelMaterials(model);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Cast Iron");
    expect(result[0].ages).toEqual(new Set());
  });

  it("detects a material with a year", () => {
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 10 }),
    );
    const result = detectModelMaterials(model);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Cast Iron");
    expect(result[0].ages).toEqual(new Set([10]));
  });

  it("deduplicates pipes with the same material", () => {
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
    );
    const result = detectModelMaterials(model);
    expect(result).toHaveLength(1);
    expect(result[0].ages).toEqual(new Set([0]));
  });

  it("collects distinct age buckets for the same material", () => {
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "Cast Iron", year: CURRENT_YEAR - 15 }),
    );
    const result = detectModelMaterials(model);
    expect(result).toHaveLength(1);
    expect(result[0].ages).toEqual(new Set([0, 10]));
  });

  it("detects multiple materials", () => {
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR - 5 }),
      makePipe(2, { material: "PVC", year: CURRENT_YEAR - 3 }),
    );
    const result = detectModelMaterials(model);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe("Cast Iron");
    expect(result[1].label).toBe("PVC");
  });

  it("buckets ages in 10-year steps", () => {
    const ages = [1, 3, 4, 5, 6, 11, 12, 17, 19, 21, 23, 27];
    const model = makeModel(
      ...ages.map((age, i) =>
        makePipe(i + 1, { material: "Cast Iron", year: CURRENT_YEAR - age }),
      ),
    );
    const result = detectModelMaterials(model);
    expect(result).toHaveLength(1);
    expect(result[0].ages).toEqual(new Set([0, 10, 20]));
  });

  it("sorts results alphabetically by label", () => {
    const model = makeModel(
      makePipe(1, { material: "PVC" }),
      makePipe(2, { material: "Cast Iron" }),
      makePipe(3, { material: "Ductile Iron" }),
    );
    const labels = detectModelMaterials(model).map((m) => m.label);
    expect(labels).toEqual(["Cast Iron", "Ductile Iron", "PVC"]);
  });

  it("clamps age to 0 for pipes with a future installation year", () => {
    const model = makeModel(
      makePipe(1, { material: "Cast Iron", year: CURRENT_YEAR + 5 }),
    );
    const result = detectModelMaterials(model);
    expect(result[0].ages).toEqual(new Set([0]));
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

const makeModel = (...pipes: Pipe[]): HydraulicModel => {
  const assets = new AssetsMap();
  for (const pipe of pipes) {
    assets.set(pipe.id, pipe);
  }
  return { assets } as HydraulicModel;
};
