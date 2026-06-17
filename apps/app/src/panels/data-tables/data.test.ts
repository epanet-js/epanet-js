import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import type { TranslateFn } from "src/hooks/use-translate";
import {
  assetAccessor,
  buildAssetModelRows,
  isAssetComputedKey,
  type AssetRow,
} from "./data";

const translate = ((key: string) => key) as TranslateFn;

const ctxFor = (model: ReturnType<typeof buildModel>) => ({
  model,
  simulation: null,
  translate,
});

function buildModel() {
  return HydraulicModelBuilder.with()
    .aJunction(1, { label: "J1", elevation: 25 })
    .aJunction(2, { label: "J2", elevation: 30 })
    .aJunctionDemand(1, [{ baseDemand: 10 }])
    .aPipe(3, { label: "P1", startNodeId: 1, endNodeId: 2 })
    .build();
}

describe("isAssetComputedKey", () => {
  it("treats sim_* and known computed columns as computed", () => {
    expect(isAssetComputedKey("junction", "baseDemand")).toBe(true);
    expect(isAssetComputedKey("junction", "sim_pressure")).toBe(true);
    expect(isAssetComputedKey("pipe", "startNode")).toBe(true);
  });

  it("treats direct attributes as not computed", () => {
    expect(isAssetComputedKey("junction", "elevation")).toBe(false);
    expect(isAssetComputedKey("junction", "label")).toBe(false);
    expect(isAssetComputedKey("pipe", "diameter")).toBe(false);
  });
});

describe("buildAssetModelRows", () => {
  it("returns the model objects (with id) filtered by type", () => {
    const model = buildModel();
    const rows = buildAssetModelRows("junction", model);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    // Direct attributes resolve straight off the model object (getters), which
    // is what accessorKey reads.
    expect((rows[0] as unknown as { elevation: number }).elevation).toBe(25);
  });
});

describe("assetAccessor (computed columns)", () => {
  it("computes junction demand columns from the model", () => {
    const model = buildModel();
    const ctx = ctxFor(model);
    const row = { id: 1 } as AssetRow;

    expect(assetAccessor("junction", "baseDemand", ctx)(row)).toBe(10);
    expect(assetAccessor("junction", "demandsCount", ctx)(row)).toBe(1);
    expect(assetAccessor("junction", "patternId", ctx)(row)).toBeNull();
    expect(assetAccessor("junction", "avgDemand", ctx)(row)).toBe(10);
  });

  it("resolves pipe connection labels from the model", () => {
    const model = buildModel();
    const ctx = ctxFor(model);
    const row = { id: 3 } as AssetRow;

    expect(assetAccessor("pipe", "startNode", ctx)(row)).toBe("J1");
    expect(assetAccessor("pipe", "endNode", ctx)(row)).toBe("J2");
  });

  it("returns null for sim_* columns when there is no simulation", () => {
    const model = buildModel();
    const ctx = ctxFor(model);
    const row = { id: 1 } as AssetRow;

    expect(assetAccessor("junction", "sim_pressure", ctx)(row)).toBeNull();
  });
});
