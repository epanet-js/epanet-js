import { describe, it, expect } from "vitest";
import { createSpatialIndex } from "./spatial-index";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "./asset-types/pipe";

describe("createSpatialIndex", () => {
  it("creates spatial index from pipes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 };
    const { assets } = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J2),
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
    expect(spatialIndexData.segments[0].properties.linkId).toBe(String(IDS.P1));
  });

  it("returns null spatial index when no pipes", () => {
    const spatialIndexData = createSpatialIndex([]);

    expect(spatialIndexData.spatialIndex).toBeNull();
    expect(spatialIndexData.segments).toHaveLength(0);
  });

  it("handles multiple pipes with segments", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 };
    const { assets } = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aJunction(IDS.J3, { coordinates: [0, 10] })
      .aPipe(IDS.P1, {
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J2),
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aPipe(IDS.P2, {
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J3),
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

    const pipeIds = spatialIndexData.segments.map((s) => s.properties.linkId);
    expect(pipeIds).toContain(String(IDS.P1));
    expect(pipeIds).toContain(String(IDS.P2));
  });
});
