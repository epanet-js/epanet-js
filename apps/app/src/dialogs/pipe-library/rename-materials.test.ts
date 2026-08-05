import { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import { renameAssignments } from "./rename-materials";

const toPatches = (assignments: ReturnType<typeof renameAssignments>) =>
  assignments.flatMap(({ assetIds, material }) =>
    assetIds.map((id) => ({ id, type: "pipe", properties: { material } })),
  );

describe("renameAssignments", () => {
  it("renames material on matching pipes", () => {
    const model = makeModel(
      makePipe(1, { material: "CI" }),
      makePipe(2, { material: "CI" }),
    );
    const renames = new Map([["CI", "Cast Iron"]]);

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { material: "Cast Iron" } },
      { id: 2, type: "pipe", properties: { material: "Cast Iron" } },
    ]);
  });

  it("skips pipes without a material", () => {
    const model = makeModel(makePipe(1, {}));
    const renames = new Map([["CI", "Cast Iron"]]);

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("renames pipes whose material differs from the library by case", () => {
    const model = makeModel(
      makePipe(1, { material: "cast iron" }),
      makePipe(2, { material: "Cast Iron" }),
    );
    const renames = new Map([["Cast Iron", "Steel"]]);

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { material: "Steel" } },
      { id: 2, type: "pipe", properties: { material: "Steel" } },
    ]);
  });

  it("normalizes pipes when only the casing of the label changes", () => {
    const model = makeModel(makePipe(1, { material: "cast iron" }));
    const renames = new Map([["Cast Iron", "CAST IRON"]]);

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { material: "CAST IRON" } },
    ]);
  });

  it("skips pipes whose material is not in the rename map", () => {
    const model = makeModel(makePipe(1, { material: "PVC" }));
    const renames = new Map([["CI", "Cast Iron"]]);

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([]);
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

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([
      { id: 1, type: "pipe", properties: { material: "Cast Iron" } },
      { id: 2, type: "pipe", properties: { material: "Ductile Iron" } },
    ]);
  });

  it("skips no-op renames where old equals new", () => {
    const model = makeModel(makePipe(1, { material: "CI" }));
    const renames = new Map([["CI", "CI"]]);

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("returns empty patches when there are no pipes", () => {
    const model = makeModel();
    const renames = new Map([["CI", "Cast Iron"]]);

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([]);
  });

  it("returns empty patches when rename map is empty", () => {
    const model = makeModel(makePipe(1, { material: "CI" }));
    const renames = new Map<string, string>();

    const assignments = renameAssignments(model, renames);

    expect(toPatches(assignments)).toEqual([]);
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
