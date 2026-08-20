import { describe, it, expect, beforeEach } from "vitest";
import { prepareWorkerData } from "./prepare-data";
import {
  PipeSegmentsView,
  PipesView,
  NodesView,
  CustomerPointsView,
  deserializeZoneGeometry,
} from "./run-data";
import type { MultiPolygon } from "geojson";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.flatbushIndex).toBeInstanceOf(bufferType);
        expect(workerData.pipeSegments).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);

        const searchResults = flatbush.search(-1, -1, 11, 1);

        expect(searchResults).toHaveLength(1);
        expect(searchResults[0]).toBe(0);
      });

      it("can read pipeSegment coordinates and pipe index from binary", () => {
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.pipeSegments).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);
        const searchResults = flatbush.search(-1, -1, 11, 1);
        const pipeSegmentIndex = searchResults[0];

        const coordinates = new PipeSegmentsView(
          workerData.pipeSegments,
        ).getCoordinates(pipeSegmentIndex);
        const pipeIndex = new PipeSegmentsView(
          workerData.pipeSegments,
        ).getPipeIndex(pipeSegmentIndex);

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.pipes).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);
        const searchResults = flatbush.search(-1, -1, 11, 1);
        const pipeSegmentIndex = searchResults[0];

        const pipeIndex = new PipeSegmentsView(
          workerData.pipeSegments,
        ).getPipeIndex(pipeSegmentIndex);
        const diameter = new PipesView(workerData.pipes).getDiameter(pipeIndex);

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.pipes).toBeInstanceOf(bufferType);

        const flatbush = Flatbush.from(workerData.flatbushIndex);
        const searchResults = flatbush.search(-1, -1, 11, 1);
        const pipeSegmentIndex = searchResults[0];

        const pipeIndex = new PipeSegmentsView(
          workerData.pipeSegments,
        ).getPipeIndex(pipeSegmentIndex);
        const startNodeIndex = new PipesView(
          workerData.pipes,
        ).getStartNodeIndex(pipeIndex);
        const endNodeIndex = new PipesView(workerData.pipes).getEndNodeIndex(
          pipeIndex,
        );

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

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes).toBeInstanceOf(bufferType);

        const node1Coordinates = new NodesView(workerData.nodes).getCoordinates(
          0,
        );
        const node2Coordinates = new NodesView(workerData.nodes).getCoordinates(
          1,
        );

        expect(node1Coordinates).toEqual([5, 10]);
        expect(node2Coordinates).toEqual([15, 20]);
      });

      it("can get node types from binary data", () => {
        const IDS = { J1: 1, R1: 2, T1: 3, P1: 4, P2: 5 };
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
          .aPipe(IDS.P2, {
            startNodeId: IDS.J1,
            endNodeId: IDS.T1,
            diameter: 12,
            coordinates: [
              [0, 0],
              [20, 0],
            ],
          })
          .build();

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes).toBeInstanceOf(bufferType);

        const junctionType = new NodesView(workerData.nodes).getType(0);
        const reservoirType = new NodesView(workerData.nodes).getType(1);
        const tankType = new NodesView(workerData.nodes).getType(2);

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
          P2: 6,
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
          .aPipe(IDS.P2, {
            startNodeId: IDS.J2,
            endNodeId: IDS.T1,
            diameter: 12,
            coordinates: [
              [30, 0],
              [20, 0],
            ],
          })
          .build();

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes).toBeInstanceOf(bufferType);

        expect(new NodesView(workerData.nodes).getId(0)).toBe(IDS.J1);
        expect(new NodesView(workerData.nodes).getId(1)).toBe(IDS.R1);
        expect(new NodesView(workerData.nodes).getId(2)).toBe(IDS.T1);
        expect(new NodesView(workerData.nodes).getId(3)).toBe(IDS.J2);
      });

      it("skips pipes with an endpoint missing from the model", () => {
        const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aJunction(IDS.J3, { coordinates: [20, 0] })
          .aJunction(IDS.J4, { coordinates: [30, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
            diameter: 12,
            coordinates: [
              [0, 0],
              [10, 0],
            ],
          })
          .aPipe(IDS.P2, {
            startNodeId: IDS.J3,
            endNodeId: IDS.J4,
            diameter: 12,
            coordinates: [
              [20, 0],
              [30, 0],
            ],
          })
          .build();

        hydraulicModel.assets.delete(IDS.J4);

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes.byteLength).toBe(8 + 2 * 24);
        expect(new NodesView(workerData.nodes).getId(0)).toBe(IDS.J1);
        expect(new NodesView(workerData.nodes).getId(1)).toBe(IDS.J2);
      });

      it("only indexes nodes connected to an allocatable pipe", () => {
        const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aJunction(IDS.J3, { coordinates: [20, 0] })
          .aJunction(IDS.J4, { coordinates: [30, 0] })
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
            diameter: 12,
            coordinates: [
              [0, 0],
              [10, 0],
            ],
          })
          .aPipe(IDS.P2, {
            startNodeId: IDS.J3,
            endNodeId: IDS.J4,
            diameter: null,
            coordinates: [
              [20, 0],
              [30, 0],
            ],
          })
          .build();

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.nodes.byteLength).toBe(8 + 2 * 24);
        expect(new NodesView(workerData.nodes).getId(0)).toBe(IDS.J1);
        expect(new NodesView(workerData.nodes).getId(1)).toBe(IDS.J2);
      });

      it("can get customer point coordinates from binary data", () => {
        const IDS = { J1: 1, CP1: 2, J2: 3, CP2: 4, P1: 5 };
        const hydraulicModel = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { coordinates: [0, 0] })
          .aCustomerPoint(IDS.CP1, {
            coordinates: [5, 10],
          })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aCustomerPoint(IDS.CP2, {
            coordinates: [15, 20],
          })
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

        const customerPoints = Array.from(
          hydraulicModel.customerPoints.values(),
        );
        const workerData = prepareWorkerData(
          hydraulicModel,
          customerPoints,
          bufferTypeParam,
        );

        expect(workerData.customerPoints).toBeInstanceOf(bufferType);

        const cp1Coordinates = new CustomerPointsView(
          workerData.customerPoints,
        ).getCoordinates(0);
        const cp2Coordinates = new CustomerPointsView(
          workerData.customerPoints,
        ).getCoordinates(1);

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
          .aCustomerPoint(IDS.CP1, {
            coordinates: [5, 10],
          })
          .aJunction(IDS.J2, { coordinates: [10, 0] })
          .aCustomerPoint(IDS.CP2, {
            coordinates: [15, 20],
          })
          .aJunction(IDS.J3, { coordinates: [20, 0] })
          .aCustomerPoint(IDS.CP3, {
            coordinates: [25, 30],
          })
          .aJunction(IDS.J4, { coordinates: [30, 0] })
          .aCustomerPoint(IDS.CP4, {
            coordinates: [35, 40],
          })
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

        const customerPoints = Array.from(
          hydraulicModel.customerPoints.values(),
        );
        const workerData = prepareWorkerData(
          hydraulicModel,
          customerPoints,
          bufferTypeParam,
        );

        expect(workerData.customerPoints).toBeInstanceOf(bufferType);

        expect(new CustomerPointsView(workerData.customerPoints).getId(0)).toBe(
          IDS.CP1,
        );
        expect(new CustomerPointsView(workerData.customerPoints).getId(1)).toBe(
          IDS.CP2,
        );
        expect(new CustomerPointsView(workerData.customerPoints).getId(2)).toBe(
          IDS.CP3,
        );
        expect(new CustomerPointsView(workerData.customerPoints).getId(3)).toBe(
          IDS.CP4,
        );
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.customerPoints).toBeInstanceOf(bufferType);
        expect(workerData.customerPoints.byteLength).toBe(8);
      });

      it("can deserialize a simple zone geometry from worker data", () => {
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

        const zoneGeometry: MultiPolygon = {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
            ],
          ],
        };

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
          zoneGeometry,
        );

        expect(workerData.zoneGeometry).toBeInstanceOf(bufferType);

        const result = deserializeZoneGeometry(workerData.zoneGeometry!);
        expect(result.type).toBe("MultiPolygon");
        expect(result.coordinates).toHaveLength(1);
        expect(result.coordinates[0]).toHaveLength(1);
        expect(result.coordinates[0][0]).toHaveLength(5);

        for (let i = 0; i < zoneGeometry.coordinates[0][0].length; i++) {
          expect(result.coordinates[0][0][i][0]).toBeCloseTo(
            zoneGeometry.coordinates[0][0][i][0],
            5,
          );
          expect(result.coordinates[0][0][i][1]).toBeCloseTo(
            zoneGeometry.coordinates[0][0][i][1],
            5,
          );
        }
      });

      it("can deserialize a multi-polygon zone geometry from worker data", () => {
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

        const zoneGeometry: MultiPolygon = {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [5, 0],
                [5, 5],
                [0, 5],
                [0, 0],
              ],
            ],
            [
              [
                [20, 20],
                [30, 20],
                [30, 30],
                [20, 30],
                [20, 20],
              ],
            ],
          ],
        };

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
          zoneGeometry,
        );

        const result = deserializeZoneGeometry(workerData.zoneGeometry!);

        expect(result.coordinates).toHaveLength(2);
        expect(result.coordinates[0][0]).toHaveLength(5);
        expect(result.coordinates[1][0]).toHaveLength(5);
        expect(result.coordinates[1][0][0][0]).toBeCloseTo(20, 5);
        expect(result.coordinates[1][0][0][1]).toBeCloseTo(20, 5);
      });

      it("can deserialize a polygon with a hole from worker data", () => {
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

        const zoneGeometry: MultiPolygon = {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [20, 0],
                [20, 20],
                [0, 20],
                [0, 0],
              ],
              [
                [5, 5],
                [15, 5],
                [15, 15],
                [5, 15],
                [5, 5],
              ],
            ],
          ],
        };

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
          zoneGeometry,
        );

        const result = deserializeZoneGeometry(workerData.zoneGeometry!);

        expect(result.coordinates).toHaveLength(1);
        expect(result.coordinates[0]).toHaveLength(2);
        expect(result.coordinates[0][0]).toHaveLength(5);
        expect(result.coordinates[0][1]).toHaveLength(5);
        expect(result.coordinates[0][1][0][0]).toBeCloseTo(5, 5);
      });

      it("excludes zoneGeometry from worker data when no zone is provided", () => {
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

        const workerData = prepareWorkerData(
          hydraulicModel,
          [],
          bufferTypeParam,
        );

        expect(workerData.zoneGeometry).toBeUndefined();
      });
    },
  );
});
