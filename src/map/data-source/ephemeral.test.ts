import { buildEphemeralStateSource } from "./ephemeral";
import { IDMap, UIDMap } from "src/lib/id-mapper";
import { EphemeralEditingState } from "src/state/jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { EphemeralDrawLink } from "../mode-handlers/draw-link";
import { LinkAsset, NodeAsset, AssetsMap } from "src/hydraulic-model";
import { EphemeralMoveAssets } from "src/map/mode-handlers/none/move-state";
import { EphemeralDrawNode } from "../mode-handlers/draw-node/ephemeral-draw-node-state";

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
    it("builds features for draw link state", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [10, 20] })
        .aJunction("J2", { coordinates: [30, 40] })
        .aPipe("P1", {
          coordinates: [
            [10, 20],
            [30, 40],
          ],
        })
        .build();

      const startNode = assets.get("J1")! as NodeAsset;
      const snappingCandidate = assets.get("J2")! as NodeAsset;
      const link = assets.get("P1")! as LinkAsset;

      const ephemeralState: EphemeralDrawLink = {
        type: "drawLink",
        startNode,
        linkType: link.type,
        link,
        snappingCandidate,
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      expect(features).toHaveLength(3);

      const [snappingFeature, startNodeFeature, linkFeature] = features;

      expect(snappingFeature.id).toBe(`snapping-${snappingCandidate.id}`);
      expect(snappingFeature.properties).toMatchObject({ halo: true });
      expect(snappingFeature.geometry).toEqual({
        type: "Point",
        coordinates: [30, 40],
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

    it("handles non-junction nodes with icons", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aTank("T1")
        .aReservoir("R1")
        .build();

      const tank = assets.get("T1")!;
      const reservoir = assets.get("R1")!;

      const ephemeralState: EphemeralDrawLink = {
        type: "drawLink",
        linkType: "pipe",
        startNode: tank as NodeAsset,
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
        snappingCandidate: reservoir as NodeAsset,
      };

      const features = buildEphemeralStateSource(
        ephemeralState,
        mockIDMap,
        assets,
      );

      const [snappingFeature, startNodeFeature] = features;

      expect(snappingFeature.properties).toMatchObject({
        halo: true,
        icon: "reservoir-highlight",
      });

      expect(startNodeFeature.properties).toMatchObject({
        icon: "tank-highlight",
      });
    });
  });

  describe("moveAssets", () => {
    it("builds features for move assets state", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aTank("T1_OLD", { coordinates: [10, 20] })
        .aJunction("J1_OLD", { coordinates: [30, 40] })
        .aTank("T1_NEW", { coordinates: [50, 60] })
        .aJunction("J1_NEW", { coordinates: [70, 80] })
        .build();

      const tankOld = assets.get("T1_OLD")!;
      const junctionOld = assets.get("J1_OLD")!;
      const tankNew = assets.get("T1_NEW")!;
      const junctionNew = assets.get("J1_NEW")!;

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

      expect(junctionFeature.properties).toEqual({});
      expect(junctionFeature.geometry).toEqual(junctionNew.feature.geometry);
    });
  });

  describe("drawNode state", () => {
    it("builds features for junction node snapping", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const ephemeralState: EphemeralDrawNode = {
        type: "drawNode",
        nodeType: "junction",
        pipeSnappingPosition: [5, 0],
        pipeId: "P1",
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
      const { assets } = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const ephemeralState: EphemeralDrawNode = {
        type: "drawNode",
        nodeType: "reservoir",
        pipeSnappingPosition: [5, 0],
        pipeId: "P1",
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
      const { assets } = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const ephemeralState: EphemeralDrawNode = {
        type: "drawNode",
        nodeType: "tank",
        pipeSnappingPosition: [5, 0],
        pipeId: "P1",
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
