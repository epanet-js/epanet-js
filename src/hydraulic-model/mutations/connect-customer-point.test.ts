import { describe, it, expect } from "vitest";
import { connectCustomerPoint } from "src/hydraulic-model/mutations/connect-customer-point";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import {
  createSpatialIndex,
  SpatialIndexData,
} from "src/hydraulic-model/spatial-index";

describe("connectCustomerPoint", () => {
  it("connects customer point to pipe and assigns junction", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
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

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [5, 1] });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection).toBeDefined();
    expect(connection!.pipeId).toBe("P1");
    expect(connection!.snapPoint).toBeDefined();
    expect(connection!.distance).toBeGreaterThan(0);
    expect(connection!.junction).toBeDefined();
    expect(connection!.junction!.type).toBe("junction");

    expect(mutableHydraulicModel.customerPoints.has("CP1")).toBe(true);
    expect(customerPoint.connection).toBeDefined();
  });

  it("returns null when no pipes exist", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [5, 1] });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection).toBeNull();
  });

  it("assigns to closest junction when multiple junctions available", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
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

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [8, 1] });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection!.junction!.id).toBe("J2");
  });

  it("excludes tanks and reservoirs from junction assignment", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
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

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [8, 1] });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection).toBeDefined();
    expect(connection!.junction!.id).toBe("J1");
    expect(connection!.junction!.type).toBe("junction");
  });

  it("returns null when no valid junctions available", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
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

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [5, 1] });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection).toBeNull();
  });

  it("connects to closest pipe when multiple pipes are nearby", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
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

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [5, 1] });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection!.pipeId).toBe("P1");
    expect(connection!.junction).toBeDefined();
  });

  it("handles null spatial index gracefully", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const spatialIndexData: SpatialIndexData = {
      spatialIndex: null,
      segments: [],
    };
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [5, 1] });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection).toBeNull();
  });

  it("creates bidirectional relationship between customer point and junction", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
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

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", {
      coordinates: [3, 1],
      demand: 50,
    });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection).toBeDefined();
    const junction = connection!.junction!;

    expect(junction.customerPointCount).toBe(1);
    expect(junction.customerPoints).toContain(customerPoint);
  });

  it("sets junction demand to 0 by default", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], baseDemand: 100 })
      .aJunction("J2", { coordinates: [10, 0], baseDemand: 50 })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [3, 1] });

    const junction = mutableHydraulicModel.assets.get("J1") as Junction;
    expect(junction?.baseDemand).toBe(100);

    connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(junction?.baseDemand).toBe(0);
  });

  it("preserves junction demand when keepDemands is true", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], baseDemand: 100 })
      .aJunction("J2", { coordinates: [10, 0], baseDemand: 50 })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", { coordinates: [3, 1] });

    const junction = mutableHydraulicModel.assets.get("J1") as Junction;
    expect(junction?.baseDemand).toBe(100);

    connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
      {
        keepDemands: true,
      },
    );

    expect(junction?.baseDemand).toBe(100);
  });

  it("connects to closest pipe when one pipe has multiple segments", () => {
    const mutableHydraulicModel = HydraulicModelBuilder.with()
      .aJunction("42377", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("36511", { coordinates: [-95.4077939, 29.702706499999998] })
      .aJunction("34565", { coordinates: [-95.4067166, 29.7042533] })
      .aJunction("44030", { coordinates: [-95.4088497, 29.7015361] })
      .aPipe("53021", {
        startNodeId: "42377",
        endNodeId: "36511",
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706499999998],
        ],
      })
      .aPipe("11778", {
        startNodeId: "34565",
        endNodeId: "44030",
        coordinates: [
          [-95.4067166, 29.7042533],
          [-95.407341, 29.703475900000004],
          [-95.407883, 29.7027583],
          [-95.4088497, 29.7015361],
        ],
      })
      .build();

    const pipes = getAssetsByType<Pipe>(mutableHydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);
    const customerPoint = buildCustomerPoint("CP1", {
      coordinates: [-95.40901589995099, 29.70185854971288],
    });

    const connection = connectCustomerPoint(
      mutableHydraulicModel,
      spatialIndexData,
      customerPoint,
    );

    expect(connection).toBeDefined();
    expect(connection!.pipeId).toBe("11778");
  });
});
