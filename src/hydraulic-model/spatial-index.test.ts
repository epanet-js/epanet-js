import { describe, it, expect } from "vitest";
import { createSpatialIndex } from "./spatial-index";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "./asset-types/pipe";

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
