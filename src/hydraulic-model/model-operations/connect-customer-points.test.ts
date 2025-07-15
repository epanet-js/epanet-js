import { describe, it, expect } from "vitest";
import { connectCustomerPointsToPipes } from "./connect-customer-points";
import { createCustomerPoint } from "src/hydraulic-model/customer-points";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("connectCustomerPointsToPipes", () => {
  it("connects customer points to nearest pipes", () => {
    const { assets } = HydraulicModelBuilder.with()
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
      .build();

    const customerPoints = new Map([
      ["CP1", createCustomerPoint([5, 1], {}, "CP1")],
    ]);

    const connectedPoints = connectCustomerPointsToPipes(
      customerPoints,
      assets,
    );

    const cp1 = connectedPoints.get("CP1");
    expect(cp1).toBeDefined();
    expect(cp1!.connection).toBeDefined();
    expect(cp1!.connection!.pipeId).toBe("P1");
    expect(cp1!.connection!.snapPoint).toBeDefined();
    expect(cp1!.connection!.distance).toBeGreaterThan(0);
  });

  it("handles empty customer points map", () => {
    const { assets } = HydraulicModelBuilder.with()
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
      .build();

    const customerPoints = new Map();

    const result = connectCustomerPointsToPipes(customerPoints, assets);

    expect(result.size).toBe(0);
  });

  it("handles network with no pipes", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPoints = new Map([
      ["CP1", createCustomerPoint([5, 1], {}, "CP1")],
    ]);

    const result = connectCustomerPointsToPipes(customerPoints, assets);

    const cp1 = result.get("CP1");
    expect(cp1).toBeDefined();
    expect(cp1!.connection).toBeUndefined();
  });

  it("connects multiple customer points to different pipes", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aJunction("J3", { coordinates: [0, 10] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aPipe("P2", {
        startNodeId: "J1",
        endNodeId: "J3",
        coordinates: [
          [0, 0],
          [0, 10],
        ],
      })
      .build();

    const customerPoints = new Map([
      ["CP1", createCustomerPoint([5, 1], {}, "CP1")],
      ["CP2", createCustomerPoint([1, 5], {}, "CP2")],
    ]);

    const connectedPoints = connectCustomerPointsToPipes(
      customerPoints,
      assets,
    );

    const cp1 = connectedPoints.get("CP1");
    expect(cp1!.connection!.pipeId).toBe("P1");

    const cp2 = connectedPoints.get("CP2");
    expect(cp2!.connection!.pipeId).toBe("P2");
  });

  it("preserves original customer point properties", () => {
    const { assets } = HydraulicModelBuilder.with()
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
      .build();

    const originalProperties = { name: "Test Customer", demand: 100 };
    const customerPoints = new Map([
      ["CP1", createCustomerPoint([5, 1], originalProperties, "CP1")],
    ]);

    const connectedPoints = connectCustomerPointsToPipes(
      customerPoints,
      assets,
    );

    const cp1 = connectedPoints.get("CP1");
    expect(cp1!.properties).toEqual(originalProperties);
    expect(cp1!.connection).toBeDefined();
  });

  it("finds closest pipe when multiple pipes are nearby", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aJunction("J3", { coordinates: [0, 5] })
      .aJunction("J4", { coordinates: [10, 5] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        coordinates: [
          [0, 5],
          [10, 5],
        ],
      })
      .build();

    const customerPoints = new Map([
      ["CP1", createCustomerPoint([5, 1], {}, "CP1")],
    ]);

    const connectedPoints = connectCustomerPointsToPipes(
      customerPoints,
      assets,
    );

    const cp1 = connectedPoints.get("CP1");
    expect(cp1!.connection!.pipeId).toBe("P1");
    expect(cp1!.connection!.distance).toBeGreaterThan(0);
  });
});
