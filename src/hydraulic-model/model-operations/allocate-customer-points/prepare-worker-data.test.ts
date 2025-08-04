import { describe, it, expect } from "vitest";
import {
  prepareWorkerData,
  getSegmentCoordinates,
  getSegmentPipeIndex,
  getPipeDiameter,
  getPipeStartNodeIndex,
  getPipeEndNodeIndex,
  getNodeCoordinates,
  getNodeType,
  getNodeId,
  getCustomerPointCoordinates,
  getCustomerPointId,
} from "./prepare-worker-data";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { AllocationRule } from "./types";
import Flatbush from "flatbush";

describe("prepareWorkerData", () => {
  it("creates SharedArrayBuffer Flatbush that returns search results", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.flatbushIndexData).toBeInstanceOf(SharedArrayBuffer);
    expect(workerData.segmentsData).toBeInstanceOf(SharedArrayBuffer);

    const flatbush = Flatbush.from(workerData.flatbushIndexData);

    const searchResults = flatbush.search(-1, -1, 11, 1);

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toBe(0);
  });

  it("can read segment coordinates and pipe index from binary", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.segmentsData).toBeInstanceOf(SharedArrayBuffer);

    const flatbush = Flatbush.from(workerData.flatbushIndexData);
    const searchResults = flatbush.search(-1, -1, 11, 1);
    const segmentIndex = searchResults[0];

    const coordinates = getSegmentCoordinates(
      workerData.segmentsData,
      segmentIndex,
    );
    const pipeIndex = getSegmentPipeIndex(
      workerData.segmentsData,
      segmentIndex,
    );

    expect(coordinates).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(pipeIndex).toBe(0);
  });

  it("can get pipe diameter from binary data using pipe index", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.pipesData).toBeInstanceOf(SharedArrayBuffer);

    const flatbush = Flatbush.from(workerData.flatbushIndexData);
    const searchResults = flatbush.search(-1, -1, 11, 1);
    const segmentIndex = searchResults[0];

    const pipeIndex = getSegmentPipeIndex(
      workerData.segmentsData,
      segmentIndex,
    );
    const diameter = getPipeDiameter(workerData.pipesData, pipeIndex);

    expect(diameter).toBe(12);
  });

  it("can get pipe start and end node indexes from binary data", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.pipesData).toBeInstanceOf(SharedArrayBuffer);

    const flatbush = Flatbush.from(workerData.flatbushIndexData);
    const searchResults = flatbush.search(-1, -1, 11, 1);
    const segmentIndex = searchResults[0];

    const pipeIndex = getSegmentPipeIndex(
      workerData.segmentsData,
      segmentIndex,
    );
    const startNodeIndex = getPipeStartNodeIndex(
      workerData.pipesData,
      pipeIndex,
    );
    const endNodeIndex = getPipeEndNodeIndex(workerData.pipesData, pipeIndex);

    expect(startNodeIndex).toBe(0);
    expect(endNodeIndex).toBe(1);
  });

  it("can get node coordinates from binary data", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [5, 10] })
      .aJunction("J2", { coordinates: [15, 20] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [5, 10],
          [15, 20],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.nodesData).toBeInstanceOf(SharedArrayBuffer);

    const node1Coordinates = getNodeCoordinates(workerData.nodesData, 0);
    const node2Coordinates = getNodeCoordinates(workerData.nodesData, 1);

    expect(node1Coordinates).toEqual([5, 10]);
    expect(node2Coordinates).toEqual([15, 20]);
  });

  it("can get node types from binary data", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aReservoir("R1", { coordinates: [10, 0] })
      .aTank("T1", { coordinates: [20, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "R1",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.nodesData).toBeInstanceOf(SharedArrayBuffer);

    const junctionType = getNodeType(workerData.nodesData, 0);
    const reservoirType = getNodeType(workerData.nodesData, 1);
    const tankType = getNodeType(workerData.nodesData, 2);

    expect(junctionType).toBe("junction");
    expect(reservoirType).toBe("reservoir");
    expect(tankType).toBe("tank");
  });

  it("can get node IDs from binary data", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aReservoir("reservoir-with-long-name", { coordinates: [10, 0] })
      .aTank("0", { coordinates: [20, 0] })
      .aJunction("exactly-32-character-node-id-ok", { coordinates: [30, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "reservoir-with-long-name",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.nodesData).toBeInstanceOf(SharedArrayBuffer);

    const shortId = getNodeId(workerData.nodesData, 0);
    const longId = getNodeId(workerData.nodesData, 1);
    const zeroId = getNodeId(workerData.nodesData, 2);
    const exactly32Id = getNodeId(workerData.nodesData, 3);

    expect(shortId).toBe("J1");
    expect(longId).toBe("reservoir-with-long-name");
    expect(zeroId).toBe("0");
    expect(exactly32Id).toBe("exactly-32-character-node-id-ok");
  });

  it("handles edge cases for node ID encoding", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("", { coordinates: [0, 0] })
      .aReservoir("00", { coordinates: [10, 0] })
      .aTank("special-chars-123!@#", { coordinates: [20, 0] })
      .aPipe("P1", {
        startNodeId: "",
        endNodeId: "00",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    const emptyId = getNodeId(workerData.nodesData, 0);
    const doubleZeroId = getNodeId(workerData.nodesData, 1);
    const specialCharsId = getNodeId(workerData.nodesData, 2);

    expect(emptyId).toBe("");
    expect(doubleZeroId).toBe("00");
    expect(specialCharsId).toBe("special-chars-123!@#");
  });

  it("can get customer point coordinates from binary data", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .withCustomerPoint("CP1", "J1", { coordinates: [5, 10], demand: 1.5 })
      .aJunction("J2", { coordinates: [10, 0] })
      .withCustomerPoint("CP2", "J2", { coordinates: [15, 20], demand: 2.0 })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const customerPoints = Array.from(hydraulicModel.customerPoints.values());
    const workerData = prepareWorkerData(
      hydraulicModel,
      allocationRules,
      customerPoints,
    );

    expect(workerData.customerPointsData).toBeInstanceOf(SharedArrayBuffer);

    const cp1Coordinates = getCustomerPointCoordinates(
      workerData.customerPointsData,
      0,
    );
    const cp2Coordinates = getCustomerPointCoordinates(
      workerData.customerPointsData,
      1,
    );

    expect(cp1Coordinates).toEqual([5, 10]);
    expect(cp2Coordinates).toEqual([15, 20]);
  });

  it("can get customer point IDs from binary data", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .withCustomerPoint("CP1", "J1", { coordinates: [5, 10], demand: 1.5 })
      .aJunction("J2", { coordinates: [10, 0] })
      .withCustomerPoint("customer-with-long-name", "J2", {
        coordinates: [15, 20],
        demand: 2.0,
      })
      .aJunction("J3", { coordinates: [20, 0] })
      .withCustomerPoint("0", "J3", { coordinates: [25, 30], demand: 3.0 })
      .aJunction("J4", { coordinates: [30, 0] })
      .withCustomerPoint("exactly-32-character-customer-i", "J4", {
        coordinates: [35, 40],
        demand: 4.0,
      })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const customerPoints = Array.from(hydraulicModel.customerPoints.values());
    const workerData = prepareWorkerData(
      hydraulicModel,
      allocationRules,
      customerPoints,
    );

    expect(workerData.customerPointsData).toBeInstanceOf(SharedArrayBuffer);

    const shortId = getCustomerPointId(workerData.customerPointsData, 0);
    const longId = getCustomerPointId(workerData.customerPointsData, 1);
    const zeroId = getCustomerPointId(workerData.customerPointsData, 2);
    const exactly32Id = getCustomerPointId(workerData.customerPointsData, 3);

    expect(shortId).toBe("CP1");
    expect(longId).toBe("customer-with-long-name");
    expect(zeroId).toBe("0");
    expect(exactly32Id).toBe("exactly-32-character-customer-i");
  });

  it("handles edge cases for customer point ID encoding", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .withCustomerPoint("", "J1", { coordinates: [5, 10], demand: 1.5 })
      .aJunction("J2", { coordinates: [10, 0] })
      .withCustomerPoint("00", "J2", { coordinates: [15, 20], demand: 2.0 })
      .aJunction("J3", { coordinates: [20, 0] })
      .withCustomerPoint("special-chars-123!@#", "J3", {
        coordinates: [25, 30],
        demand: 3.0,
      })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const customerPoints = Array.from(hydraulicModel.customerPoints.values());
    const workerData = prepareWorkerData(
      hydraulicModel,
      allocationRules,
      customerPoints,
    );

    const emptyId = getCustomerPointId(workerData.customerPointsData, 0);
    const doubleZeroId = getCustomerPointId(workerData.customerPointsData, 1);
    const specialCharsId = getCustomerPointId(workerData.customerPointsData, 2);

    expect(emptyId).toBe("");
    expect(doubleZeroId).toBe("00");
    expect(specialCharsId).toBe("special-chars-123!@#");
  });

  it("handles hydraulic model with no customer points", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const workerData = prepareWorkerData(hydraulicModel, allocationRules, []);

    expect(workerData.customerPointsData).toBeInstanceOf(SharedArrayBuffer);
    expect(workerData.customerPointsData.byteLength).toBe(8);
  });
});
