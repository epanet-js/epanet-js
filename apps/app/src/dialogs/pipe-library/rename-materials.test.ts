import { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import { renameMaterialsMoment } from "./rename-materials";

describe("renameMaterialsMoment", () => {
  it("renames material on matching pipes", () => {
    const model = makeModel(
      makePipe(1, { material: "CI" }),
      makePipe(2, { material: "CI" }),
    );
    const renames = new Map([["CI", "Cast Iron"]]);

    const moment = renameMaterialsMoment(model, renames);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { material: "Cast Iron" } },
      { id: 2, type: "pipe", properties: { material: "Cast Iron" } },
    ]);
  });

  it("skips pipes without a material", () => {
    const model = makeModel(makePipe(1, {}));
    const renames = new Map([["CI", "Cast Iron"]]);

    const moment = renameMaterialsMoment(model, renames);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("skips pipes whose material is not in the rename map", () => {
    const model = makeModel(makePipe(1, { material: "PVC" }));
    const renames = new Map([["CI", "Cast Iron"]]);

    const moment = renameMaterialsMoment(model, renames);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("handles multiple renames", () => {
    const model = makeModel(
      makePipe(1, { material: "CI" }),
      makePipe(2, { material: "DI" }),
    );
    const renames = new Map([
      ["CI", "Cast Iron"],
      ["DI", "Ductile Iron"],
    ]);

    const moment = renameMaterialsMoment(model, renames);

    expect(moment.patchAssetsAttributes).toEqual([
      { id: 1, type: "pipe", properties: { material: "Cast Iron" } },
      { id: 2, type: "pipe", properties: { material: "Ductile Iron" } },
    ]);
  });

  it("skips no-op renames where old equals new", () => {
    const model = makeModel(makePipe(1, { material: "CI" }));
    const renames = new Map([["CI", "CI"]]);

    const moment = renameMaterialsMoment(model, renames);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("returns empty patches when there are no pipes", () => {
    const model = makeModel();
    const renames = new Map([["CI", "Cast Iron"]]);

    const moment = renameMaterialsMoment(model, renames);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });

  it("returns empty patches when rename map is empty", () => {
    const model = makeModel(makePipe(1, { material: "CI" }));
    const renames = new Map<string, string>();

    const moment = renameMaterialsMoment(model, renames);

    expect(moment.patchAssetsAttributes).toEqual([]);
  });
});

const makePipe = (id: number, props: { material?: string }): Pipe =>
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
