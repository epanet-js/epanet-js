import { describe, it, expect } from "vitest";
import {
  connectCustomerPointToPipe,
  createSpatialIndex,
  assignJunctionToCustomerPoint,
  SpatialIndexData,
} from "./connect-customer-points";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";

describe("connectCustomerPointToPipe", () => {
  it("connects customer point to nearest pipe", () => {
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

    const connection = connectCustomerPointToPipe(
      customerPoint,
      spatialIndexData,
    );

    expect(connection).toBeDefined();
    expect(connection!.pipeId).toBe("P1");
    expect(connection!.snapPoint).toBeDefined();
    expect(connection!.distance).toBeGreaterThan(0);
  });

  it("returns null when no pipes exist", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 0 });

    const connection = connectCustomerPointToPipe(
      customerPoint,
      spatialIndexData,
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

    const connection = connectCustomerPointToPipe(
      customerPoint,
      spatialIndexData,
    );

    expect(connection!.pipeId).toBe("P1");
    expect(connection!.distance).toBeGreaterThan(0);
  });

  it("handles null spatial index gracefully", () => {
    const spatialIndexData: SpatialIndexData = {
      spatialIndex: null,
      segments: [],
    };
    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 0 });

    const connection = connectCustomerPointToPipe(
      customerPoint,
      spatialIndexData,
    );

    expect(connection).toBeNull();
  });
});

describe("createSpatialIndex", () => {
  it("creates spatial index from pipes", () => {
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

    expect(spatialIndexData.spatialIndex).toBeDefined();
    expect(spatialIndexData.segments).toHaveLength(1);
    expect(spatialIndexData.segments[0].properties?.pipeId).toBe("P1");
  });

  it("returns null spatial index when no pipes", () => {
    const spatialIndexData = createSpatialIndex([]);

    expect(spatialIndexData.spatialIndex).toBeNull();
    expect(spatialIndexData.segments).toHaveLength(0);
  });

  it("handles multiple pipes with segments", () => {
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

    const pipes = getAssetsByType<Pipe>(assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);

    expect(spatialIndexData.spatialIndex).toBeDefined();
    expect(spatialIndexData.segments).toHaveLength(2);

    const pipeIds = spatialIndexData.segments.map(
      (s) => s.properties?.pipeId as string,
    );
    expect(pipeIds).toContain("P1");
    expect(pipeIds).toContain("P2");
  });
});

describe("assignJunctionToCustomerPoint", () => {
  it("assigns customer point to closest junction on connected pipe", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const customerPoint = new CustomerPoint("CP1", [3, 1], { baseDemand: 50 });
    const connection = { pipeId: "P1", snapPoint: [3, 0], distance: 1 };

    const assignedJunction = assignJunctionToCustomerPoint(
      customerPoint,
      connection,
      assets,
    );

    expect(assignedJunction).toBeDefined();
    expect(assignedJunction!.id).toBe("J1");
  });

  it("excludes tanks and reservoirs from assignment", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aTank("T1", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "T1" })
      .build();

    const customerPoint = new CustomerPoint("CP1", [8, 1], { baseDemand: 50 });
    const connection = { pipeId: "P1", snapPoint: [8, 0], distance: 1 };

    const assignedJunction = assignJunctionToCustomerPoint(
      customerPoint,
      connection,
      assets,
    );

    expect(assignedJunction).toBeDefined();
    expect(assignedJunction!.id).toBe("J1");
    expect(assignedJunction!.type).toBe("junction");
  });

  it("returns null when no valid junctions available", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aTank("T1", { coordinates: [0, 0] })
      .aReservoir("R1", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "T1", endNodeId: "R1" })
      .build();

    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 50 });
    const connection = { pipeId: "P1", snapPoint: [5, 0], distance: 1 };

    const assignedJunction = assignJunctionToCustomerPoint(
      customerPoint,
      connection,
      assets,
    );

    expect(assignedJunction).toBeNull();
  });

  it("assigns to single junction when only one available", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aTank("T1", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "T1" })
      .build();

    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 50 });
    const connection = { pipeId: "P1", snapPoint: [5, 0], distance: 1 };

    const assignedJunction = assignJunctionToCustomerPoint(
      customerPoint,
      connection,
      assets,
    );

    expect(assignedJunction).toBeDefined();
    expect(assignedJunction!.id).toBe("J1");
  });

  it("returns null when pipe not found", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPoint = new CustomerPoint("CP1", [5, 1], { baseDemand: 50 });
    const connection = {
      pipeId: "P_NONEXISTENT",
      snapPoint: [5, 0],
      distance: 1,
    };

    const assignedJunction = assignJunctionToCustomerPoint(
      customerPoint,
      connection,
      assets,
    );

    expect(assignedJunction).toBeNull();
  });

  it("chooses closest junction when multiple junctions available", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const customerPoint = new CustomerPoint("CP1", [9, 1], { baseDemand: 50 });
    const connection = { pipeId: "P1", snapPoint: [9, 0], distance: 1 };

    const assignedJunction = assignJunctionToCustomerPoint(
      customerPoint,
      connection,
      assets,
    );

    expect(assignedJunction).toBeDefined();
    expect(assignedJunction!.id).toBe("J2");
  });
});
