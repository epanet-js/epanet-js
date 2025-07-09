import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { IDMap, UIDMap } from "src/lib/id-mapper";
import { buildIconPointsSource } from "./icons";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { Point } from "geojson";

describe("build icons source", () => {
  describe("for pumps", () => {
    it("computes the feature of the pump icon", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("p1")
        .aPump("pu2", {
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "on",
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.type).toEqual("pump");
      expect(properties?.status).toEqual("on");
      expect(properties?.rotation).toBeCloseTo(84, 0.1);
      expect(properties?.selected).toBeFalsy();

      const geometry = features[0].geometry as Point;
      expect(geometry.type).toEqual("Point");
      expect(geometry.coordinates[0]).toBeCloseTo(15);
      expect(geometry.coordinates[1]).toBeCloseTo(1.5, 0.1);
    });

    it("can handle pumps with 0 length", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPump("pu2", {
          coordinates: [
            [10, 1],
            [10, 1],
          ],
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.type).toEqual("pump");
      expect(properties?.status).toEqual("on");
      expect(properties?.rotation).toEqual(0);
      expect(properties?.selected).toBeFalsy();

      const geometry = features[0].geometry as Point;
      expect(geometry.type).toEqual("Point");
      expect(geometry.coordinates[0]).toEqual(10);
      expect(geometry.coordinates[1]).toEqual(1);
    });
  });

  describe("for valves", () => {
    it("computes the feature of the valve icon", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("p1")
        .aValve("v1", {
          kind: "prv",
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "active",
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.type).toEqual("valve");
      expect(properties?.kind).toEqual("prv");
      expect(properties?.icon).toEqual("valve-prv-active");
      expect(properties?.rotation).toBeCloseTo(84, 0.1);
      expect(properties?.selected).toBeFalsy();
      expect(properties?.isControlValve).toBeTruthy();

      const geometry = features[0].geometry as Point;
      expect(geometry.type).toEqual("Point");
      expect(geometry.coordinates[0]).toBeCloseTo(15);
      expect(geometry.coordinates[1]).toBeCloseTo(1.5, 0.1);
    });

    it("uses simulation status when available", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("p1")
        .aValve("v1", {
          kind: "prv",
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "active",
          simulation: { status: "closed" },
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.icon).toEqual("valve-prv-closed");
    });
  });
});

const initIDMap = (assets: AssetsMap): IDMap => {
  return UIDMap.loadIdsFromPersistence([...assets.values()]);
};
