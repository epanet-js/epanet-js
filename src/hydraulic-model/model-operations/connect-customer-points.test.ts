import { describe, it, expect } from "vitest";
import { connectCustomerPoint } from "./connect-customer-points";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import {
  createSpatialIndex,
  SpatialIndexData,
} from "src/hydraulic-model/spatial-index";

describe("connectCustomerPoint", () => {
  it("connects customer point to pipe and assigns junction", () => {
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

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 0 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection).toBeDefined();
    expect(connection!.pipeId).toBe("P1");
    expect(connection!.snapPoint).toBeDefined();
    expect(connection!.distance).toBeGreaterThan(0);
    expect(connection!.junction).toBeDefined();
    expect(connection!.junction!.type).toBe("junction");
  });

  it("returns null when no pipes exist", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 0 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection).toBeNull();
  });

  it("assigns to closest junction when multiple junctions available", () => {
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

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [8, 1], { baseDemand: 0 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection!.junction!.id).toBe("J2"); // Closer to snap point at [8, 0]
  });

  it("excludes tanks and reservoirs from junction assignment", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aTank("T1", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "T1",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [8, 1], { baseDemand: 0 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection).toBeDefined();
    expect(connection!.junction!.id).toBe("J1"); // Tank excluded, junction assigned
    expect(connection!.junction!.type).toBe("junction");
  });

  it("returns null when no valid junctions available", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aTank("T1", { coordinates: [0, 0] })
      .aReservoir("R1", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "T1",
        endNodeId: "R1",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 0 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection).toBeNull();
  });

  it("connects to closest pipe when multiple pipes are nearby", () => {
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

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 0 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection!.pipeId).toBe("P1"); // Closer to P1
    expect(connection!.junction).toBeDefined();
  });

  it("handles null spatial index gracefully", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const spatialIndexData: SpatialIndexData = {
      spatialIndex: null,
      segments: [],
    };
    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 0 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection).toBeNull();
  });

  it("creates bidirectional relationship between customer point and junction", () => {
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

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [3, 1], { baseDemand: 50 });

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    expect(connection).toBeDefined();
    const junction = connection!.junction!;

    expect(junction.customerPointCount).toBe(1);
    expect(junction.customerPoints).toContain(customerPoint);
  });
});
