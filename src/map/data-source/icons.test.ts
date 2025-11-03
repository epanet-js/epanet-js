import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildIconPointsSource } from "./icons";
import { AssetId } from "src/hydraulic-model";
import { Point } from "geojson";

describe("build icons source", () => {
  describe("for pumps", () => {
    it("computes the feature of the pump icon", () => {
      const IDS = { p1: 1, pu2: 2 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1)
        .aPump(IDS.pu2, {
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "on",
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

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
      const IDS = { pu2: 1 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPump(IDS.pu2, {
          coordinates: [
            [10, 1],
            [10, 1],
          ],
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

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
      const IDS = { p1: 1, v1: 2 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1)
        .aValve(IDS.v1, {
          kind: "prv",
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "active",
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

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
      const IDS = { p1: 1, v1: 2 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1)
        .aValve(IDS.v1, {
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

      const features = buildIconPointsSource(assets, selectedAssets);

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.icon).toEqual("valve-prv-closed");
    });
  });

  describe("for CV pipes", () => {
    it("computes the feature of the CV pipe icon", () => {
      const IDS = { p1: 1 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1, {
          initialStatus: "cv",
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.type).toEqual("pipe");
      expect(properties?.icon).toEqual("pipe-cv-open");
      expect(properties?.rotation).toBeCloseTo(84, 0.1);
      expect(properties?.selected).toBeFalsy();

      const geometry = features[0].geometry as Point;
      expect(geometry.type).toEqual("Point");
      expect(geometry.coordinates[0]).toBeCloseTo(15);
      expect(geometry.coordinates[1]).toBeCloseTo(1.5, 0.1);
    });

    it("uses simulation status for CV pipe icon selection", () => {
      const IDS = { p1: 1 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1, {
          initialStatus: "cv",
          coordinates: [
            [10, 1],
            [20, 2],
          ],
          simulation: { status: "closed" },
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.icon).toEqual("pipe-cv-closed");
    });

    it("handles CV pipe with null simulation status", () => {
      const IDS = { p1: 1 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1, {
          initialStatus: "cv",
          coordinates: [
            [10, 1],
            [20, 2],
          ],
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.icon).toEqual("pipe-cv-open");
    });

    it("excludes non-CV pipes from icon generation", () => {
      const IDS = { p1: 1 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1, {
          initialStatus: "open",
          coordinates: [
            [10, 1],
            [20, 2],
          ],
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

      expect(features.length).toEqual(0);
    });

    it("uses open icon for CV pipe with open simulation status", () => {
      const IDS = { p1: 1 } as const;
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1, {
          initialStatus: "cv",
          coordinates: [
            [10, 1],
            [20, 2],
          ],
          simulation: { status: "open" },
        })
        .build();

      const features = buildIconPointsSource(assets, selectedAssets);

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.icon).toEqual("pipe-cv-open");
    });
  });
});
