import { describe, it, expect } from "vitest";
import { deleteAssets } from "./delete-assets";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("deleteAssets", () => {
  it("disconnects customer points when deleting pipe", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint("CP1", {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: "P1", junctionId: "J1" },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: ["P1"],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toEqual(["P1"]);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe("CP1");
    expect(disconnectedCP.baseDemand).toBe(25);
    expect(disconnectedCP.coordinates).toEqual([2, 1]);
    expect(disconnectedCP.connection).toBeNull();
  });

  it("disconnects customer points when deleting junction that cascades to pipe deletion", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint("CP1", {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: "P1", junctionId: "J1" },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: ["J1"],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toContain("J1");
    expect(deletedAssetIds).toContain("P1");
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe("CP1");
    expect(disconnectedCP.connection).toBeNull();
  });

  it("does not disconnect customer points by default", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint("CP1", {
        demand: 25,
        coordinates: [2, 1],
        connection: { pipeId: "P1", junctionId: "J1" },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: ["P1"],
      },
    );

    expect(deletedAssetIds).toEqual(["P1"]);
    expect(putCustomerPoints).toBeUndefined();
  });
});
