import { buildEphemeralStateSource } from "./ephemeral";
import { IDMap, UIDMap } from "src/lib/id-mapper";
import { EphemeralEditingState } from "src/state/jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { LinkAsset, NodeAsset, AssetsMap } from "src/hydraulic-model";
import { EphemeralMoveAssets } from "src/map/mode-handlers/none/move-state";
import { EphemeralDrawNode } from "../mode-handlers/draw-node/ephemeral-draw-node-state";
import { EphemeralDrawLink } from "../mode-handlers/draw-link/ephemeral-link-state";

describe("build ephemeral state source", () => {
  const mockIDMap: IDMap = UIDMap.loadIdsFromPersistence([]);
  const emptyAssets = new AssetsMap();

  it("returns empty array for null state", () => {
    const ephemeralState: EphemeralEditingState = { type: "none" };
    const features = buildEphemeralStateSource(
      ephemeralState,
      mockIDMap,
      emptyAssets,
    );
    expect(features).toEqual([]);
  });

  it("returns empty array for unknown state type", () => {
    const ephemeralState = { type: "unknown" } as any;
    const features = buildEphemeralStateSource(
      ephemeralState,
      mockIDMap,
      emptyAssets,
    );
    expect(features).toEqual([]);
  });

  describe("drawLink state", () => {
    it("builds features for new drawLink with node snapping", () => {
      const IDS = { J1: 1, T1: 2 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [10, 20] })
        .aTank(IDS.T1, { coordinates: [30, 40] })
        .build();

      const startNode = assets.get(String(IDS.J1))! as NodeAsset;
      const snappingTank = assets.get(String(IDS.T1))! as NodeAsset;

      const ephemeralState: EphemeralDrawLink = {
        type: "drawLink",
        linkType: "pipe",
        link: {
          id: "P1",
          type: "pipe",
          coordinates: [
            [10, 20],
            [30, 40],
          ],
          feature: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [10, 20],
                [30, 40],
              ],
            },
            properties: {
              type: "pipe",
              label: "P1",
              connections: ["", ""],
              length: 0,
            },
          },
        } as LinkAsset,
        startNode,
        snappingCandidate: snappingTank,
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(3);

      const [snappingFeature, startNodeFeature, linkFeature] = features;

      expect(snappingFeature.id).toBe(`snapping-${snappingTank.type}`);
      expect(snappingFeature.properties).toMatchObject({
        halo: true,
        icon: "tank-highlight",
      });
      expect(snappingFeature.geometry).toEqual({
        type: "Point",
        coordinates: snappingTank.coordinates,
      });

      expect(startNodeFeature.id).toBe(startNode.id);
      expect(startNodeFeature.geometry).toEqual({
        type: "Point",
        coordinates: [10, 20],
      });

      expect(linkFeature.id).toBe("draw-link-line");
      expect(linkFeature.geometry).toEqual({
        type: "LineString",
        coordinates: [
          [10, 20],
          [30, 40],
        ],
      });
    });

    it("builds features for new drawLink with pipe snapping", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [10, 20] })
        .aJunction(IDS.J2, { coordinates: [50, 60] })
        .aPipe(IDS.P1, {
          coordinates: [
            [30, 40],
            [70, 80],
          ],
        })
        .build();

      const startNode = assets.get(String(IDS.J1))! as NodeAsset;

      const ephemeralState: EphemeralDrawLink = {
        type: "drawLink",
        linkType: "pipe",
        link: {
          id: "P2",
          type: "pipe",
          coordinates: [
            [10, 20],
            [45, 55],
          ],
          feature: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [10, 20],
                [45, 55],
              ],
            },
            properties: {
              type: "pipe",
              label: "P2",
              connections: ["", ""],
              length: 0,
            },
          },
        } as LinkAsset,
        startNode,
        snappingCandidate: {
          type: "pipe",
          coordinates: [45, 55],
          id: String(IDS.P1),
          vertexIndex: null,
        },
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(4);

      const [
        snappingFeature,
        pipeHighlightFeature,
        startNodeFeature,
        linkFeature,
      ] = features;

      expect(snappingFeature.id).toBe("snapping-pipe");
      expect(snappingFeature.properties).toMatchObject({
        halo: true,
      });
      expect(snappingFeature.properties).not.toHaveProperty("icon");
      expect(snappingFeature.geometry).toEqual({
        type: "Point",
        coordinates: [45, 55],
      });

      expect(pipeHighlightFeature.id).toBe(`pipe-highlight-${IDS.P1}`);
      expect(pipeHighlightFeature.properties).toMatchObject({
        pipeHighlight: true,
      });
      expect(pipeHighlightFeature.geometry).toEqual({
        type: "LineString",
        coordinates: [
          [30, 40],
          [70, 80],
        ],
      });

      expect(startNodeFeature.id).toBe(startNode.id);
      expect(linkFeature.id).toBe("draw-link-line");
    });

    it("handles pipe snapping when pipe asset not found", () => {
      const IDS = { J1: 1 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [10, 20] })
        .build();

      const startNode = assets.get(String(IDS.J1))! as NodeAsset;

      const ephemeralState: EphemeralDrawLink = {
        type: "drawLink",
        linkType: "pipe",
        link: {
          id: "P2",
          type: "pipe",
          coordinates: [
            [10, 20],
            [45, 55],
          ],
          feature: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [10, 20],
                [45, 55],
              ],
            },
            properties: {
              type: "pipe",
              label: "P2",
              connections: ["", ""],
              length: 0,
            },
          },
        } as LinkAsset,
        startNode,
        snappingCandidate: {
          type: "pipe",
          coordinates: [45, 55],
          id: "NONEXISTENT",
          vertexIndex: null,
        },
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(3);

      const [snappingFeature, startNodeFeature, linkFeature] = features;

      expect(snappingFeature.id).toBe("snapping-pipe");
      expect(startNodeFeature.id).toBe(startNode.id);
      expect(linkFeature.id).toBe("draw-link-line");
    });
  });

  describe("moveAssets", () => {
    it("builds features for move assets state", () => {
      const IDS = { T1_OLD: 1, J1_OLD: 2, T1_NEW: 3, J1_NEW: 4 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aTank(IDS.T1_OLD, { coordinates: [10, 20] })
        .aJunction(IDS.J1_OLD, { coordinates: [30, 40] })
        .aTank(IDS.T1_NEW, { coordinates: [50, 60] })
        .aJunction(IDS.J1_NEW, { coordinates: [70, 80] })
        .build();

      const tankOld = assets.get(String(IDS.T1_OLD))!;
      const junctionOld = assets.get(String(IDS.J1_OLD))!;
      const tankNew = assets.get(String(IDS.T1_NEW))!;
      const junctionNew = assets.get(String(IDS.J1_NEW))!;

      const ephemeralState: EphemeralMoveAssets = {
        type: "moveAssets",
        oldAssets: [tankOld, junctionOld],
        targetAssets: [tankNew, junctionNew],
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(2);

      const [tankFeature, junctionFeature] = features;

      expect(tankFeature.properties).toMatchObject({ icon: "tank-highlight" });
      expect(tankFeature.geometry).toEqual(tankNew.feature.geometry);

      expect(junctionFeature.properties).toEqual({ draft: true });
      expect(junctionFeature.geometry).toEqual(junctionNew.feature.geometry);
    });
  });

  describe("drawNode state", () => {
    it("builds features for junction node snapping", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .build();

      const ephemeralState: EphemeralDrawNode = {
        type: "drawNode",
        nodeType: "junction",
        pipeSnappingPosition: [5, 0],
        pipeId: String(IDS.P1),
        nodeSnappingId: null,
        nodeReplacementId: null,
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(2);
      const [pipeHighlight, snapPoint] = features;

      expect(pipeHighlight.properties).toMatchObject({ pipeHighlight: true });
      expect(snapPoint.id).toBe("pipe-snap-point");
      expect(snapPoint.properties).toMatchObject({ halo: true });
      expect(snapPoint.properties).not.toHaveProperty("icon");
    });

    it("builds features for reservoir node snapping with icon", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .build();

      const ephemeralState: EphemeralDrawNode = {
        type: "drawNode",
        nodeType: "reservoir",
        pipeSnappingPosition: [5, 0],
        pipeId: String(IDS.P1),
        nodeSnappingId: null,
        nodeReplacementId: null,
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(2);
      const [, snapPoint] = features;

      expect(snapPoint.properties).toMatchObject({
        halo: true,
        icon: "reservoir-highlight",
      });
    });

    it("builds features for tank node snapping with icon", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .build();

      const ephemeralState: EphemeralDrawNode = {
        type: "drawNode",
        nodeType: "tank",
        pipeSnappingPosition: [5, 0],
        pipeId: String(IDS.P1),
        nodeSnappingId: null,
        nodeReplacementId: null,
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(2);
      const [, snapPoint] = features;

      expect(snapPoint.properties).toMatchObject({
        halo: true,
        icon: "tank-highlight",
      });
    });
  });
});
