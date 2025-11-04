import { describe, it, expect } from "vitest";
import {
  AssetTypeQueries,
  AssetTypesEncoder,
  AssetTypesView,
} from "./asset-type-queries";
import { AssetIndexEncoder, AssetIndexView } from "./asset-index";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { HydraulicModel } from "src/hydraulic-model";

describe("AssetTypeQueries - Basic Functionality", () => {
  it("returns asset type for existing assets", () => {
    const IDS = {
      J1: 1,
      T1: 2,
      R1: 3,
      P1: 10,
      V1: 11,
      Pump1: 12,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aTank(IDS.T1)
      .aReservoir(IDS.R1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .aValve(IDS.V1, { startNodeId: IDS.T1, endNodeId: IDS.R1 })
      .aPump(IDS.Pump1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);

    expect(queries.getAssetType(IDS.J1)).toBe("junction");
    expect(queries.getAssetType(IDS.T1)).toBe("tank");
    expect(queries.getAssetType(IDS.R1)).toBe("reservoir");
    expect(queries.getAssetType(IDS.P1)).toBe("pipe");
    expect(queries.getAssetType(IDS.V1)).toBe("valve");
    expect(queries.getAssetType(IDS.Pump1)).toBe("pump");
  });

  it("returns node type for nodes only", () => {
    const IDS = {
      J1: 1,
      T1: 2,
      R1: 3,
      P1: 10,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aTank(IDS.T1)
      .aReservoir(IDS.R1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .build();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);

    expect(queries.getNodeType(IDS.J1)).toBe("junction");
    expect(queries.getNodeType(IDS.T1)).toBe("tank");
    expect(queries.getNodeType(IDS.R1)).toBe("reservoir");
    expect(queries.getNodeType(IDS.P1)).toBeUndefined();
  });

  it("returns link type for links only", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 10,
      V1: 11,
      Pump1: 12,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aValve(IDS.V1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPump(IDS.Pump1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);

    expect(queries.getLinkType(IDS.P1)).toBe("pipe");
    expect(queries.getLinkType(IDS.V1)).toBe("valve");
    expect(queries.getLinkType(IDS.Pump1)).toBe("pump");
    expect(queries.getLinkType(IDS.J1)).toBeUndefined();
    expect(queries.getLinkType(IDS.J2)).toBeUndefined();
  });

  it("handles invalid IDs gracefully", () => {
    const model = HydraulicModelBuilder.with().aJunction(1).build();
    const queries = new AssetTypeQueries(model.assets, model.assetIndex);

    expect(queries.getAssetType(0)).toBeUndefined();
    expect(queries.getAssetType(-1)).toBeUndefined();
    expect(queries.getAssetType(999)).toBeUndefined();
    expect(queries.getNodeType(0)).toBeUndefined();
    expect(queries.getNodeType(-1)).toBeUndefined();
    expect(queries.getNodeType(999)).toBeUndefined();
    expect(queries.getLinkType(0)).toBeUndefined();
    expect(queries.getLinkType(-1)).toBeUndefined();
    expect(queries.getLinkType(999)).toBeUndefined();
  });
});

describe("AssetTypesView - Behaves same as AssetTypeQueries", () => {
  it("getAssetType returns same results as AssetTypeQueries", () => {
    const IDS = {
      J1: 1,
      T1: 2,
      R1: 3,
      P1: 10,
      V1: 11,
      Pump1: 12,
      notDefined: 50,
      outOfBounds: 999,
      invalidId: 0,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aTank(IDS.T1)
      .aReservoir(IDS.R1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .aValve(IDS.V1, { startNodeId: IDS.T1, endNodeId: IDS.R1 })
      .aPump(IDS.Pump1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);
    const view = getAssetTypesView(model);

    expect(view.getAssetType(IDS.P1)).toEqual(queries.getAssetType(IDS.P1));
    expect(view.getAssetType(IDS.J1)).toEqual(queries.getAssetType(IDS.J1));
    expect(view.getAssetType(IDS.T1)).toEqual(queries.getAssetType(IDS.T1));
    expect(view.getAssetType(IDS.R1)).toEqual(queries.getAssetType(IDS.R1));
    expect(view.getAssetType(IDS.V1)).toEqual(queries.getAssetType(IDS.V1));
    expect(view.getAssetType(IDS.Pump1)).toEqual(
      queries.getAssetType(IDS.Pump1),
    );

    expect(view.getAssetType(IDS.notDefined)).toEqual(
      queries.getAssetType(IDS.notDefined),
    );
    expect(view.getAssetType(IDS.outOfBounds)).toEqual(
      queries.getAssetType(IDS.outOfBounds),
    );
    expect(view.getAssetType(IDS.invalidId)).toEqual(
      queries.getAssetType(IDS.invalidId),
    );
  });

  it("getNodeType returns same results as AssetTypeQueries", () => {
    const IDS = {
      J1: 1,
      T1: 2,
      R1: 3,
      P1: 10,
      notDefined: 50,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aTank(IDS.T1)
      .aReservoir(IDS.R1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .build();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);
    const view = getAssetTypesView(model);

    expect(view.getNodeType(IDS.J1)).toEqual(queries.getNodeType(IDS.J1));
    expect(view.getNodeType(IDS.T1)).toEqual(queries.getNodeType(IDS.T1));
    expect(view.getNodeType(IDS.R1)).toEqual(queries.getNodeType(IDS.R1));
    expect(view.getNodeType(IDS.P1)).toEqual(queries.getNodeType(IDS.P1));
    expect(view.getNodeType(IDS.notDefined)).toEqual(
      queries.getNodeType(IDS.notDefined),
    );
  });

  it("getLinkType returns same results as AssetTypeQueries", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 10,
      V1: 11,
      Pump1: 12,
      notDefined: 50,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aValve(IDS.V1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPump(IDS.Pump1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);
    const view = getAssetTypesView(model);

    expect(view.getLinkType(IDS.P1)).toEqual(queries.getLinkType(IDS.P1));
    expect(view.getLinkType(IDS.V1)).toEqual(queries.getLinkType(IDS.V1));
    expect(view.getLinkType(IDS.Pump1)).toEqual(queries.getLinkType(IDS.Pump1));
    expect(view.getLinkType(IDS.J1)).toEqual(queries.getLinkType(IDS.J1));
    expect(view.getLinkType(IDS.notDefined)).toEqual(
      queries.getLinkType(IDS.notDefined),
    );
  });

  it("handles empty model", () => {
    const IDS = {
      notDefined: 10,
    } as const;

    const model = HydraulicModelBuilder.empty();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);
    const view = getAssetTypesView(model);

    expect(view.getAssetType(IDS.notDefined)).toEqual(
      queries.getAssetType(IDS.notDefined),
    );
    expect(view.getNodeType(IDS.notDefined)).toEqual(
      queries.getNodeType(IDS.notDefined),
    );
    expect(view.getLinkType(IDS.notDefined)).toEqual(
      queries.getLinkType(IDS.notDefined),
    );
  });

  it("handles sparse IDs correctly", () => {
    const IDS = {
      J1: 5,
      J2: 150,
      P1: 100,
      P2: 200,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J1 })
      .build();

    const queries = new AssetTypeQueries(model.assets, model.assetIndex);
    const view = getAssetTypesView(model);

    expect(view.getAssetType(IDS.J1)).toEqual(queries.getAssetType(IDS.J1));
    expect(view.getAssetType(IDS.P1)).toEqual(queries.getAssetType(IDS.P1));
    expect(view.getNodeType(IDS.J2)).toEqual(queries.getNodeType(IDS.J2));
    expect(view.getLinkType(IDS.P2)).toEqual(queries.getLinkType(IDS.P2));
  });
});

function getAssetTypesView(model: HydraulicModel): AssetTypesView {
  const assetIndexEncoder = new AssetIndexEncoder(model.assetIndex);
  const assetTypesEncoder = new AssetTypesEncoder(
    model.assets,
    model.assetIndex,
  );
  const assetIndexView = new AssetIndexView(assetIndexEncoder.encode());
  return new AssetTypesView(assetTypesEncoder.encode(), assetIndexView);
}
