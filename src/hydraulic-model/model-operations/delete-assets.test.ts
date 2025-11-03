import { describe, it, expect } from "vitest";
import { deleteAssets } from "./delete-assets";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("deleteAssets", () => {
  it("disconnects customer points when deleting pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.P1],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toEqual([IDS.P1]);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe(String(IDS.CP1));
    expect(disconnectedCP.baseDemand).toBe(25);
    expect(disconnectedCP.coordinates).toEqual([2, 1]);
    expect(disconnectedCP.connection).toBeNull();
  });

  it("disconnects customer points when deleting junction that cascades to pipe deletion", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.J1],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toContain(IDS.J1);
    expect(deletedAssetIds).toContain(IDS.P1);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe(String(IDS.CP1));
    expect(disconnectedCP.connection).toBeNull();
  });

  it("does not disconnect customer points by default", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.P1],
      },
    );

    expect(deletedAssetIds).toEqual([IDS.P1]);
    expect(putCustomerPoints).toBeUndefined();
  });
});
