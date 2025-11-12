import { describe, it, expect } from "vitest";
import {
  queryContainedAssets,
  queryIntersectedAssets,
} from "./spatial-queries";
import { AssetsGeoIndex } from "./assets-geo";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("queryContainedAssets", () => {
  describe("bounding box search", () => {
    it("returns nodes fully contained in bounds", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aJunction(IDS.J3, { coordinates: [0, 10] })
        .aJunction(IDS.J4, { coordinates: [20, 20] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-1, -1, 11, 11];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.J3);
      expect(result).not.toContain(IDS.J4);
    });

    it("returns links only when all segments are contained", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        P1: 10,
        P2: 20,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aJunction(IDS.J3, { coordinates: [20, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-1, -1, 11, 1];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J3);
      expect(result).not.toContain(IDS.P2);
    });

    it("excludes links with only some segments contained", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [20, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-1, -1, 11, 1];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).not.toContain(IDS.J2);
      expect(result).not.toContain(IDS.P1);
    });

    it("includes multi-segment links when all segments are contained", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [5, 5],
            [10, 0],
          ],
        })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-1, -1, 11, 6];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
    });

    it("returns empty array when no assets in bounds", () => {
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

      const bounds: BBox4 = [20, 20, 30, 30];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toEqual([]);
    });
  });

  describe("radius search", () => {
    it("finds nodes within radius", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0.001, 0] })
        .aJunction(IDS.J3, { coordinates: [1, 1] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const radiusSearch = { position: [0, 0], radiusInM: 200 };
      const result = queryContainedAssets(assetsGeo, radiusSearch);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).not.toContain(IDS.J3);
    });

    it("finds links fully within radius", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0.0001, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const radiusSearch = { position: [0, 0], radiusInM: 50 };
      const result = queryContainedAssets(assetsGeo, radiusSearch);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
    });
  });

  describe("polygon search", () => {
    it("handles axis-aligned rectangle efficiently", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [5, 5] })
        .aJunction(IDS.J2, { coordinates: [15, 5] })
        .aJunction(IDS.J3, { coordinates: [25, 5] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const rectangle = [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
        [0, 0],
      ];
      const result = queryContainedAssets(assetsGeo, rectangle);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).not.toContain(IDS.J3);
    });

    it("handles non-axis-aligned polygon", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [5, 5] })
        .aJunction(IDS.J2, { coordinates: [10, 10] })
        .aJunction(IDS.J3, { coordinates: [25, 5] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const triangle = [
        [0, 0],
        [20, 0],
        [10, 12],
        [0, 0],
      ];
      const result = queryContainedAssets(assetsGeo, triangle);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).not.toContain(IDS.J3);
    });

    it("handles complex polygon with links", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        P1: 10,
        P2: 20,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [5, 5] })
        .aJunction(IDS.J2, { coordinates: [10, 5] })
        .aJunction(IDS.J3, { coordinates: [20, 5] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const polygon = [
        [0, 0],
        [15, 0],
        [15, 10],
        [0, 10],
        [0, 0],
      ];
      const result = queryContainedAssets(assetsGeo, polygon);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J3);
      expect(result).not.toContain(IDS.P2);
    });
  });

  describe("edge cases", () => {
    it("handles empty model", () => {
      const model = HydraulicModelBuilder.empty();
      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [0, 0, 10, 10];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toEqual([]);
    });

    it("handles search area larger than entire model", () => {
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

      const bounds: BBox4 = [-100, -100, 100, 100];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
    });

    it("handles zero-area search", () => {
      const IDS = {
        J1: 1,
        J2: 2,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [0, 0, 0, 0];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).not.toContain(IDS.J2);
    });

    it("handles multiple links sharing nodes", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        P1: 10,
        P2: 20,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [5, 0] })
        .aJunction(IDS.J3, { coordinates: [5, 5] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-1, -1, 10, 1];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J3);
      expect(result).not.toContain(IDS.P2);
    });
  });

  describe("meridian and equator crossing", () => {
    it("handles negative coordinates (southern/western hemispheres)", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [-10, -10] })
        .aJunction(IDS.J2, { coordinates: [-5, -5] })
        .aJunction(IDS.J3, { coordinates: [5, 5] })
        .aJunction(IDS.J4, { coordinates: [10, 10] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-15, -15, 0, 0];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).not.toContain(IDS.J3);
      expect(result).not.toContain(IDS.J4);
    });

    it("handles bounding box spanning the meridian (lon 0°)", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [-5, 5] })
        .aJunction(IDS.J2, { coordinates: [0, 5] })
        .aJunction(IDS.J3, { coordinates: [5, 5] })
        .aJunction(IDS.J4, { coordinates: [11, 10] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-10, 0, 10, 10];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.J3);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J4);
    });

    it("handles bounding box spanning the equator (lat 0°)", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [5, -5] })
        .aJunction(IDS.J2, { coordinates: [5, 0] })
        .aJunction(IDS.J3, { coordinates: [5, 5] })
        .aJunction(IDS.J4, { coordinates: [15, 10] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [0, -10, 10, 10];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.J3);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J4);
    });

    it("handles coordinates at origin (0, 0)", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [5, 5] })
        .aJunction(IDS.J3, { coordinates: [-5, -5] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-1, -1, 1, 1];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).not.toContain(IDS.J2);
      expect(result).not.toContain(IDS.J3);
    });

    it("handles all four geographic quadrants", () => {
      const IDS = {
        NE: 1,
        NW: 2,
        SW: 3,
        SE: 4,
        Origin: 5,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.NE, { coordinates: [5, 5] })
        .aJunction(IDS.NW, { coordinates: [-5, 5] })
        .aJunction(IDS.SW, { coordinates: [-5, -5] })
        .aJunction(IDS.SE, { coordinates: [5, -5] })
        .aJunction(IDS.Origin, { coordinates: [0, 0] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-10, -10, 10, 10];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.NE);
      expect(result).toContain(IDS.NW);
      expect(result).toContain(IDS.SW);
      expect(result).toContain(IDS.SE);
      expect(result).toContain(IDS.Origin);
    });

    it("handles links crossing the meridian", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [-5, 5] })
        .aJunction(IDS.J2, { coordinates: [5, 5] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-10, 0, 10, 10];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
    });

    it("handles links crossing the equator", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [5, -5] })
        .aJunction(IDS.J2, { coordinates: [5, 5] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [0, -10, 10, 10];
      const result = queryContainedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
    });

    it("handles polygon crossing meridian and equator", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        Outside: 5,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [-2, 2] })
        .aJunction(IDS.J2, { coordinates: [2, 2] })
        .aJunction(IDS.J3, { coordinates: [2, -2] })
        .aJunction(IDS.J4, { coordinates: [-2, -2] })
        .aJunction(IDS.Outside, { coordinates: [10, 10] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const polygon = [
        [-5, -5],
        [5, -5],
        [5, 5],
        [-5, 5],
        [-5, -5],
      ];
      const result = queryContainedAssets(assetsGeo, polygon);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.J3);
      expect(result).toContain(IDS.J4);
      expect(result).not.toContain(IDS.Outside);
    });

    it("handles radius search crossing meridian and equator", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [-0.001, -0.001] })
        .aJunction(IDS.J2, { coordinates: [0.001, 0.001] })
        .aJunction(IDS.J3, { coordinates: [1, 1] })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const radiusSearch = { position: [0, 0], radiusInM: 200 };
      const result = queryContainedAssets(assetsGeo, radiusSearch);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).not.toContain(IDS.J3);
    });
  });
});

describe("queryIntersectedAssets", () => {
  describe("bounding box search", () => {
    it("returns nodes contained and links with any segment intersecting", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 10,
        P2: 20,
        P3: 30,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aJunction(IDS.J3, { coordinates: [20, 0] })
        .aJunction(IDS.J4, { coordinates: [30, 30] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [-1, -1, 11, 1];
      const result = queryIntersectedAssets(assetsGeo, bounds);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
      expect(result).toContain(IDS.P2);
      expect(result).not.toContain(IDS.J3);
      expect(result).not.toContain(IDS.J4);
      expect(result).not.toContain(IDS.P3);
    });

    it("returns empty array when no assets in bounds", () => {
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

      const bounds: BBox4 = [20, 20, 30, 30];
      const result = queryIntersectedAssets(assetsGeo, bounds);

      expect(result).toEqual([]);
    });
  });

  describe("radius search", () => {
    it("finds nodes and links that intersect with radius", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        P1: 10,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0.001, 0] })
        .aJunction(IDS.J3, { coordinates: [1, 1] })
        .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const radiusSearch = { position: [0, 0], radiusInM: 200 };
      const result = queryIntersectedAssets(assetsGeo, radiusSearch);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
      expect(result).not.toContain(IDS.J3);
    });
  });

  describe("polygon search", () => {
    it("handles complex polygon with partial link intersections", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 10,
        P2: 20,
        P3: 30,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [5, 5] })
        .aJunction(IDS.J2, { coordinates: [10, 5] })
        .aJunction(IDS.J3, { coordinates: [20, 5] })
        .aJunction(IDS.J4, { coordinates: [30, 30] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const polygon = [
        [0, 0],
        [15, 0],
        [15, 10],
        [0, 10],
        [0, 0],
      ];
      const result = queryIntersectedAssets(assetsGeo, polygon);

      expect(result).toContain(IDS.J1);
      expect(result).toContain(IDS.J2);
      expect(result).toContain(IDS.P1);
      expect(result).toContain(IDS.P2);
      expect(result).not.toContain(IDS.J3);
      expect(result).not.toContain(IDS.J4);
      expect(result).not.toContain(IDS.P3);
    });
  });

  describe("edge cases", () => {
    it("handles empty model", () => {
      const model = HydraulicModelBuilder.empty();
      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const bounds: BBox4 = [0, 0, 10, 10];
      const result = queryIntersectedAssets(assetsGeo, bounds);

      expect(result).toEqual([]);
    });

    it("handles meridian and equator crossing with intersecting links", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        P1: 10,
        P2: 20,
      } as const;

      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [-10, 5] })
        .aJunction(IDS.J2, { coordinates: [10, 5] })
        .aJunction(IDS.J3, { coordinates: [5, -10] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
        .build();

      const assetsGeo = new AssetsGeoIndex(model.assets, model.assetIndex);

      const polygon = [
        [-5, -5],
        [5, -5],
        [5, 5],
        [-5, 5],
        [-5, -5],
      ];
      const result = queryIntersectedAssets(assetsGeo, polygon);

      expect(result).toContain(IDS.P1);
      expect(result).toContain(IDS.P2);
      expect(result).not.toContain(IDS.J1);
      expect(result).not.toContain(IDS.J2);
      expect(result).not.toContain(IDS.J3);
    });
  });
});
