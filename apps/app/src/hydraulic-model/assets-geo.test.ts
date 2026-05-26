import { describe, it, expect } from "vitest";
import { AssetIndexEncoder, AssetIndexView } from "./asset-index";
import {
  AssetsGeoIndex,
  AssetsGeoEncoder,
  AssetsGeoView,
  AssetsGeoQueries,
} from "./assets-geo";
import { HydraulicModel } from "./hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("AssetsGeoView", () => {
  it("behaves the same way as AssetsGeoIndex", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      J5: 5,
      P1: 10,
      P2: 20,
      P3: 30,
      P4: 40,
      notDefined: 99,
      outOfBounds: 200,
      invalidId: 0,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aJunction(IDS.J3, { coordinates: [10, 10] })
      .aJunction(IDS.J4, { coordinates: [0, 10] })
      .aJunction(IDS.J5, { coordinates: [5, 5] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .aPipe(IDS.P4, { startNodeId: IDS.J4, endNodeId: IDS.J1 })
      .build();

    const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);
    const assetsGeoView = getAssetsGeoView(model, assetsGeo);

    expect(assetsGeoView.getNodePosition(IDS.J1)).toEqual(
      assetsGeo.getNodePosition(IDS.J1),
    );
    expect(assetsGeoView.getNodePosition(IDS.J5)).toEqual(
      assetsGeo.getNodePosition(IDS.J5),
    );
    expect(assetsGeoView.getLinkBounds(IDS.P1)).toEqual(
      assetsGeo.getLinkBounds(IDS.P1),
    );
    expect(assetsGeoView.getLinkBounds(IDS.P3)).toEqual(
      assetsGeo.getLinkBounds(IDS.P3),
    );
    expect(assetsGeoView.segmentsCount).toEqual(assetsGeo.segmentsCount);
    expect(assetsGeoView.getLinkSegments(IDS.P1)).toEqual(
      assetsGeo.getLinkSegments(IDS.P1),
    );
    expect(assetsGeoView.getLinkSegments(IDS.P3)).toEqual(
      assetsGeo.getLinkSegments(IDS.P3),
    );

    const segment0 = assetsGeo.getLinkSegments(IDS.P1)[0];
    expect(assetsGeoView.getSegmentCoords(segment0)).toEqual(
      assetsGeo.getSegmentCoords(segment0),
    );
    expect(assetsGeoView.getSegmentLinkId(segment0)).toEqual(
      assetsGeo.getSegmentLinkId(segment0),
    );

    const segment3 = assetsGeo.getLinkSegments(IDS.P3)[0];
    expect(assetsGeoView.getSegmentCoords(segment3)).toEqual(
      assetsGeo.getSegmentCoords(segment3),
    );

    const bounds: BBox4 = [-1, -1, 11, 11];
    expect(assetsGeoView.searchNodes(bounds)).toEqual(
      assetsGeo.searchNodes(bounds),
    );
    expect(assetsGeoView.searchLinkSegments(bounds)).toEqual(
      assetsGeo.searchLinkSegments(bounds),
    );

    const neighbours = assetsGeoView.getNeighbouringNodes([5, 5], 3, 100);
    expect(neighbours).toEqual(assetsGeo.getNeighbouringNodes([5, 5], 3, 100));

    expect(assetsGeoView.getNodePosition(IDS.P1)).toEqual(
      assetsGeo.getNodePosition(IDS.P1),
    );
    expect(assetsGeoView.getLinkBounds(IDS.J1)).toEqual(
      assetsGeo.getLinkBounds(IDS.J1),
    );
    expect(assetsGeoView.getNodePosition(IDS.notDefined)).toEqual(
      assetsGeo.getNodePosition(IDS.notDefined),
    );
    expect(assetsGeoView.getLinkBounds(IDS.notDefined)).toEqual(
      assetsGeo.getLinkBounds(IDS.notDefined),
    );
    expect(assetsGeoView.getNodePosition(IDS.outOfBounds)).toEqual(
      assetsGeo.getNodePosition(IDS.outOfBounds),
    );
    expect(assetsGeoView.getLinkBounds(IDS.outOfBounds)).toEqual(
      assetsGeo.getLinkBounds(IDS.outOfBounds),
    );
    expect(assetsGeoView.getNodePosition(IDS.invalidId)).toEqual(
      assetsGeo.getNodePosition(IDS.invalidId),
    );
    expect(assetsGeoView.getLinkBounds(IDS.invalidId)).toEqual(
      assetsGeo.getLinkBounds(IDS.invalidId),
    );
    expect(assetsGeoView.getLinkSegments(IDS.notDefined)).toEqual(
      assetsGeo.getLinkSegments(IDS.notDefined),
    );
  });

  it("handles multi-segment pipes", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 10,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 10] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [5, 0],
          [5, 5],
          [10, 10],
        ],
      })
      .build();

    const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);
    const assetsGeoView = getAssetsGeoView(model, assetsGeo);

    expect(assetsGeo.segmentsCount).toBe(3);
    expect(assetsGeoView.segmentsCount).toBe(3);

    const segments = assetsGeo.getLinkSegments(IDS.P1);
    expect(segments.length).toBe(3);
    expect(assetsGeoView.getLinkSegments(IDS.P1)).toEqual(segments);

    const segment0Coords = assetsGeo.getSegmentCoords(segments[0]);
    expect(segment0Coords).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(assetsGeoView.getSegmentCoords(segments[0])).toEqual(segment0Coords);

    const segment1Coords = assetsGeo.getSegmentCoords(segments[1]);
    expect(segment1Coords).toEqual([
      [5, 0],
      [5, 5],
    ]);
    expect(assetsGeoView.getSegmentCoords(segments[1])).toEqual(segment1Coords);

    const segment2Coords = assetsGeo.getSegmentCoords(segments[2]);
    expect(segment2Coords).toEqual([
      [5, 5],
      [10, 10],
    ]);
    expect(assetsGeoView.getSegmentCoords(segments[2])).toEqual(segment2Coords);

    for (const segmentId of segments) {
      expect(assetsGeo.getSegmentLinkId(segmentId)).toBe(IDS.P1);
      expect(assetsGeoView.getSegmentLinkId(segmentId)).toBe(IDS.P1);
    }

    const bounds = assetsGeo.getLinkBounds(IDS.P1);
    expect(bounds).toEqual([0, 0, 10, 10]);
    expect(assetsGeoView.getLinkBounds(IDS.P1)).toEqual(bounds);

    const searchBounds: BBox4 = [-1, -1, 11, 11];
    const foundSegments = assetsGeo.searchLinkSegments(searchBounds);
    expect(foundSegments).toEqual(segments);
    expect(assetsGeoView.searchLinkSegments(searchBounds)).toEqual(
      foundSegments,
    );
  });

  it("handles empty model", () => {
    const IDS = {
      notDefined: 10,
    } as const;

    const model = HydraulicModelBuilder.empty();

    const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);
    const assetsGeoView = getAssetsGeoView(model, assetsGeo);

    expect(assetsGeoView.getNodePosition(IDS.notDefined)).toEqual(
      assetsGeo.getNodePosition(IDS.notDefined),
    );
    expect(assetsGeoView.getLinkBounds(IDS.notDefined)).toEqual(
      assetsGeo.getLinkBounds(IDS.notDefined),
    );
    expect(assetsGeoView.getLinkSegments(IDS.notDefined)).toEqual(
      assetsGeo.getLinkSegments(IDS.notDefined),
    );
    expect(assetsGeoView.segmentsCount).toEqual(assetsGeo.segmentsCount);
    expect(assetsGeoView.segmentsCount).toBe(0);
  });

  it("throws error for out of bounds segment ID", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 10,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);
    const assetsGeoView = getAssetsGeoView(model, assetsGeo);

    expect(() => assetsGeoView.getSegmentCoords(100)).toThrow(
      "Segment index out of bounds",
    );
    expect(() => assetsGeo.getSegmentCoords(100)).toThrow(
      "Segment index out of bounds",
    );
    expect(() => assetsGeoView.getSegmentLinkId(100)).toThrow(
      "Segment index out of bounds",
    );
    expect(() => assetsGeo.getSegmentLinkId(100)).toThrow(
      "Segment index out of bounds",
    );
  });
});

function getAssetsGeoView(
  model: HydraulicModel,
  assetsGeo: AssetsGeoQueries,
): AssetsGeoView {
  const encoder = new AssetsGeoEncoder(model.assetIndex, assetsGeo);
  for (const [nodeId, nodeIndex] of model.assetIndex.iterateNodes()) {
    encoder.encodeNode(nodeId, nodeIndex);
  }
  for (const [linkId, linkIndex] of model.assetIndex.iterateLinks()) {
    encoder.encodeLink(linkId, linkIndex);
  }
  const buffers = encoder.finalize();
  const assetIndexView = new AssetIndexView(
    new AssetIndexEncoder(model.assetIndex).encode(),
  );
  return new AssetsGeoView(buffers, assetIndexView);
}
