import { AssetsMap, Pipe } from "@epanet-js/hydraulic-model";
import { listPipeMaterials } from "./list-pipe-materials";

describe("listPipeMaterials", () => {
  it("collects distinct materials from pipes and the library", () => {
    const assets = makeAssets("PVC", "Cast Iron", "PVC");

    expect(listPipeMaterials(assets, ["Steel"])).toEqual([
      "Cast Iron",
      "PVC",
      "Steel",
    ]);
  });

  it("keeps the library label when a pipe uses another casing", () => {
    const assets = makeAssets("iron", "PVC");

    expect(listPipeMaterials(assets, ["Iron"])).toEqual(["Iron", "PVC"]);
  });

  it("keeps the first casing seen among pipes when the library has none", () => {
    const assets = makeAssets("iron", "Iron");

    expect(listPipeMaterials(assets)).toEqual(["iron"]);
  });

  it("ignores pipes without a material", () => {
    const assets = makeAssets("PVC", undefined);

    expect(listPipeMaterials(assets)).toEqual(["PVC"]);
  });

  it("sorts case-insensitively", () => {
    const assets = makeAssets("steel", "Cast Iron", "pvc");

    expect(listPipeMaterials(assets)).toEqual(["Cast Iron", "pvc", "steel"]);
  });
});

const makeAssets = (...materials: (string | undefined)[]): AssetsMap => {
  const assets = new AssetsMap();
  materials.forEach((material, index) => {
    const id = index + 1;
    assets.set(
      id,
      new Pipe(
        id,
        [
          [0, 0],
          [1, 1],
        ],
        {
          type: "pipe",
          label: `P${id}`,
          connections: [0, 0],
          initialStatus: "open",
          length: 100,
          diameter: 200,
          roughness: null,
          material,
          isActive: true,
        },
      ),
    );
  });
  return assets;
};
