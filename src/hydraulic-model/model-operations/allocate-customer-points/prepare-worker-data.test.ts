import { describe, it, expect } from "vitest";
import {
  prepareWorkerData,
  getSegmentCoordinates,
  getSegmentPipeIndex,
} from "./prepare-worker-data";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { AllocationRule } from "./allocate-customer-points";
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

    const workerData = prepareWorkerData(hydraulicModel, allocationRules);

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

    const workerData = prepareWorkerData(hydraulicModel, allocationRules);

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
    expect(pipeIndex).toBe(1);
  });
});
