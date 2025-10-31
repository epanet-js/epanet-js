import { describe, it, expect, beforeEach } from "vitest";
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
} from "./prepare-data";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { AllocationRule } from "./types";
import Flatbush from "flatbush";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";

describe("prepareWorkerData", () => {
  describe.each([
    {
      flagState: "enabled",
      bufferType: SharedArrayBuffer,
      bufferTypeParam: "shared" as const,
    },
    {
      flagState: "disabled",
      bufferType: ArrayBuffer,
      bufferTypeParam: "array" as const,
    },
  ])(
    "when FLAG_MULTI_WORKERS is $flagState",
    ({ flagState, bufferType, bufferTypeParam }) => {
      beforeEach(() => {
        if (flagState === "enabled") {
          stubFeatureOn("FLAG_MULTI_WORKERS");
        } else {
          stubFeatureOff("FLAG_MULTI_WORKERS");
        }
      });

      it("creates binary data Flatbush that returns search results", () => {
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.flatbushIndex).toBeInstanceOf(bufferType);
        expect(workerData.segments).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.segments).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);
        const searchResults = flatbush.search(-1, -1, 11, 1);
        const segmentIndex = searchResults[0];

        const coordinates = getSegmentCoordinates(
          workerData.segments,
          segmentIndex,
        );
        const pipeIndex = getSegmentPipeIndex(
          workerData.segments,
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.pipes).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);
        const searchResults = flatbush.search(-1, -1, 11, 1);
        const segmentIndex = searchResults[0];

        const pipeIndex = getSegmentPipeIndex(
          workerData.segments,
          segmentIndex,
        );
        const diameter = getPipeDiameter(workerData.pipes, pipeIndex);

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.pipes).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);
        const searchResults = flatbush.search(-1, -1, 11, 1);
        const segmentIndex = searchResults[0];

        const pipeIndex = getSegmentPipeIndex(
          workerData.segments,
          segmentIndex,
        );
        const startNodeIndex = getPipeStartNodeIndex(
          workerData.pipes,
          pipeIndex,
        );
        const endNodeIndex = getPipeEndNodeIndex(workerData.pipes, pipeIndex);

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes).toBeInstanceOf(bufferType);

        const node1Coordinates = getNodeCoordinates(workerData.nodes, 0);
        const node2Coordinates = getNodeCoordinates(workerData.nodes, 1);

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes).toBeInstanceOf(bufferType);

        const junctionType = getNodeType(workerData.nodes, 0);
        const reservoirType = getNodeType(workerData.nodes, 1);
        const tankType = getNodeType(workerData.nodes, 2);

        expect(junctionType).toBe("junction");
        expect(reservoirType).toBe("reservoir");
        expect(tankType).toBe("tank");
      });

      it("can get node IDs from binary data", () => {
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction("J1", { coordinates: [0, 0] })
          .aReservoir("reservoir-with-long-name", { coordinates: [10, 0] })
          .aTank("T0", { coordinates: [20, 0] })
          .aJunction("exactly-32-character-node-id-ok", {
            coordinates: [30, 0],
          })
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes).toBeInstanceOf(bufferType);

        const shortId = getNodeId(workerData.nodes, 0);
        const longId = getNodeId(workerData.nodes, 1);
        const zeroId = getNodeId(workerData.nodes, 2);
        const exactly32Id = getNodeId(workerData.nodes, 3);

        expect(shortId).toBe("J1");
        expect(longId).toBe("reservoir-with-long-name");
        expect(zeroId).toBe("T0");
        expect(exactly32Id).toBe("exactly-32-character-node-id-ok");
      });

      it("handles edge cases for node ID encoding", () => {
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction("J_EMPTY", { coordinates: [0, 0] })
          .aReservoir("R00", { coordinates: [10, 0] })
          .aTank("special-chars-123!@#", { coordinates: [20, 0] })
          .aPipe("P1", {
            startNodeId: "J_EMPTY",
            endNodeId: "R00",
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        const emptyId = getNodeId(workerData.nodes, 0);
        const doubleZeroId = getNodeId(workerData.nodes, 1);
        const specialCharsId = getNodeId(workerData.nodes, 2);

        expect(emptyId).toBe("J_EMPTY");
        expect(doubleZeroId).toBe("R00");
        expect(specialCharsId).toBe("special-chars-123!@#");
      });

      it("can get customer point coordinates from binary data", () => {
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction("J1", { coordinates: [0, 0] })
          .aCustomerPoint("CP1", { coordinates: [5, 10], demand: 1.5 })
          .aJunction("J2", { coordinates: [10, 0] })
          .aCustomerPoint("CP2", { coordinates: [15, 20], demand: 2.0 })
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

        const customerPoints = Array.from(
          hydraulicModel.customerPoints.values(),
        );
        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          customerPoints,
          bufferTypeParam,
        );

        expect(workerData.customerPoints).toBeInstanceOf(bufferType);

        const cp1Coordinates = getCustomerPointCoordinates(
          workerData.customerPoints,
          0,
        );
        const cp2Coordinates = getCustomerPointCoordinates(
          workerData.customerPoints,
          1,
        );

        expect(cp1Coordinates).toEqual([5, 10]);
        expect(cp2Coordinates).toEqual([15, 20]);
      });

      it("can get customer point IDs from binary data", () => {
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction("J1", { coordinates: [0, 0] })
          .aCustomerPoint("CP1", { coordinates: [5, 10], demand: 1.5 })
          .aJunction("J2", { coordinates: [10, 0] })
          .aCustomerPoint("customer-with-long-name", {
            coordinates: [15, 20],
            demand: 2.0,
          })
          .aJunction("J3", { coordinates: [20, 0] })
          .aCustomerPoint("0", { coordinates: [25, 30], demand: 3.0 })
          .aJunction("J4", { coordinates: [30, 0] })
          .aCustomerPoint("exactly-32-character-customer-i", {
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

        const customerPoints = Array.from(
          hydraulicModel.customerPoints.values(),
        );
        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          customerPoints,
          bufferTypeParam,
        );

        expect(workerData.customerPoints).toBeInstanceOf(bufferType);

        const shortId = getCustomerPointId(workerData.customerPoints, 0);
        const longId = getCustomerPointId(workerData.customerPoints, 1);
        const zeroId = getCustomerPointId(workerData.customerPoints, 2);
        const exactly32Id = getCustomerPointId(workerData.customerPoints, 3);

        expect(shortId).toBe("CP1");
        expect(longId).toBe("customer-with-long-name");
        expect(zeroId).toBe("0");
        expect(exactly32Id).toBe("exactly-32-character-customer-i");
      });

      it("handles edge cases for customer point ID encoding", () => {
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction("J1", { coordinates: [0, 0] })
          .aCustomerPoint("", { coordinates: [5, 10], demand: 1.5 })
          .aJunction("J2", { coordinates: [10, 0] })
          .aCustomerPoint("00", { coordinates: [15, 20], demand: 2.0 })
          .aJunction("J3", { coordinates: [20, 0] })
          .aCustomerPoint("special-chars-123!@#", {
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

        const customerPoints = Array.from(
          hydraulicModel.customerPoints.values(),
        );
        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          customerPoints,
          bufferTypeParam,
        );

        const emptyId = getCustomerPointId(workerData.customerPoints, 0);
        const doubleZeroId = getCustomerPointId(workerData.customerPoints, 1);
        const specialCharsId = getCustomerPointId(workerData.customerPoints, 2);

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          allocationRules,
          [],
          bufferTypeParam,
        );

        expect(workerData.customerPoints).toBeInstanceOf(bufferType);
        expect(workerData.customerPoints.byteLength).toBe(8);
      });
    },
  );
});
