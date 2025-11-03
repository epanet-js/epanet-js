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
        const IDS = { J1: 1, J2: 2, P1: 3 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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
        const IDS = { J1: 1, J2: 2, P1: 3 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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
        const IDS = { J1: 1, J2: 2, P1: 3 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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
        const IDS = { J1: 1, J2: 2, P1: 3 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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
        const IDS = { J1: 1, J2: 2, P1: 3 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [5, 10] })
          .aJunction(IDS.J2, { coordinates: [15, 20] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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
        const IDS = { J1: 1, R1: 2, T1: 3, P1: 4 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aReservoir(IDS.R1, { coordinates: [10, 0] })
          .aTank(IDS.T1, { coordinates: [20, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.R1,
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
        const IDS = {
          J1: 1,
          R1: 2,
          T1: 3,
          J2: 4,
          P1: 5,
        };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aReservoir(IDS.R1, { coordinates: [10, 0] })
          .aTank(IDS.T1, { coordinates: [20, 0] })
          .aJunction(IDS.J2, { coordinates: [30, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.R1,
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

        expect(getNodeId(workerData.nodes, 0)).toBe(IDS.J1);
        expect(getNodeId(workerData.nodes, 1)).toBe(IDS.R1);
        expect(getNodeId(workerData.nodes, 2)).toBe(IDS.T1);
        expect(getNodeId(workerData.nodes, 3)).toBe(IDS.J2);
      });

      it("can get customer point coordinates from binary data", () => {
        const IDS = { J1: 1, CP1: 2, J2: 3, CP2: 4, P1: 5 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aCustomerPoint(IDS.CP1, { coordinates: [5, 10], demand: 1.5 })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aCustomerPoint(IDS.CP2, { coordinates: [15, 20], demand: 2.0 })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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
        const IDS = {
          J1: 1,
          CP1: 2,
          J2: 3,
          CP2: 4,
          J3: 5,
          CP3: 6,
          J4: 7,
          CP4: 8,
          P1: 9,
        };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aCustomerPoint(IDS.CP1, { coordinates: [5, 10], demand: 1.5 })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aCustomerPoint(IDS.CP2, { coordinates: [15, 20], demand: 2.0 })
          .aJunction(IDS.J3, { coordinates: [20, 0] })
          .aCustomerPoint(IDS.CP3, { coordinates: [25, 30], demand: 3.0 })
          .aJunction(IDS.J4, { coordinates: [30, 0] })
          .aCustomerPoint(IDS.CP4, { coordinates: [35, 40], demand: 4.0 })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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

        expect(getCustomerPointId(workerData.customerPoints, 0)).toBe(IDS.CP1);
        expect(getCustomerPointId(workerData.customerPoints, 1)).toBe(IDS.CP2);
        expect(getCustomerPointId(workerData.customerPoints, 2)).toBe(IDS.CP3);
        expect(getCustomerPointId(workerData.customerPoints, 3)).toBe(IDS.CP4);
      });

      it("handles hydraulic model with no customer points", () => {
        const IDS = { J1: 1, J2: 2, P1: 3 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
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
