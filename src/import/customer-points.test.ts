import { describe, it, expect } from "vitest";
import { parseCustomerPointsStreamingFromFile as parseStreamingFromFile } from "./parse-customer-points";
import { createSpatialIndex } from "src/hydraulic-model/spatial-index";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";

describe("parseCustomerPointsStreamingFromFile", () => {
  const createTestSpatialIndex = () => {
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
    return { spatialIndex: createSpatialIndex(pipes), assets };
  };

  const createEmptySpatialIndex = () => {
    const { assets } = HydraulicModelBuilder.with().build();
    return { spatialIndex: createSpatialIndex([]), assets };
  };

  describe("GeoJSON parsing", () => {
    it("parses GeoJSON and connects customer points to pipes", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5, 1],
            },
            properties: {
              name: "Customer 1",
              demand: 30,
            },
          },
        ],
      };

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      expect(result.customerPoints.size).toBe(1);
      expect(result.issues).toBeNull();

      const customerPoint = result.customerPoints.get("1");
      expect(customerPoint).toBeDefined();
      expect(customerPoint!.coordinates).toEqual([5, 1]);
      expect(customerPoint!.baseDemand).toBe(30);
      expect(customerPoint!.connection).toBeDefined();
      expect(customerPoint!.connection!.pipeId).toBe("P1");
    });

    it("handles GeoJSON with no pipe connections", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5, 1],
            },
            properties: {
              name: "Customer 1",
            },
          },
        ],
      };

      const { spatialIndex, assets } = createEmptySpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      expect(result.customerPoints.size).toBe(0);
      expect(result.issues).toBeDefined();
      expect(result.issues!.skippedNoValidJunction).toBe(1);
    });

    it("skips non-Point geometries", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5, 1],
            },
            properties: {},
          },
        ],
      };

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      expect(result.customerPoints.size).toBe(1);
      expect(result.issues).toBeDefined();
      expect(result.issues!.skippedNonPointFeatures).toBe(1);
    });

    it("skips features with invalid coordinates", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5], // Invalid - missing y coordinate
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5, 1],
            },
            properties: {},
          },
        ],
      };

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      expect(result.customerPoints.size).toBe(1);
      expect(result.issues).toBeDefined();
      expect(result.issues!.skippedInvalidCoordinates).toBe(1);
    });

    it("handles empty GeoJSON", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [],
      };

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      expect(result.customerPoints.size).toBe(0);
      expect(result.issues).toBeNull();
    });
  });

  describe("GeoJSONL parsing", () => {
    it("parses GeoJSONL and connects customer points to pipes", () => {
      const geoJsonL = [
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {"name": "Customer 1"}}',
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [7, 2]}, "properties": {"name": "Customer 2"}}',
      ].join("\n");

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(geoJsonL, spatialIndex, assets, 1);

      expect(result.customerPoints.size).toBe(2);
      expect(result.issues).toBeNull();

      const cp1 = result.customerPoints.get("1");
      expect(cp1).toBeDefined();
      expect(cp1!.coordinates).toEqual([5, 1]);
      expect(cp1!.connection).toBeDefined();
      expect(cp1!.connection!.pipeId).toBe("P1");

      const cp2 = result.customerPoints.get("2");
      expect(cp2).toBeDefined();
      expect(cp2!.coordinates).toEqual([7, 2]);
      expect(cp2!.connection).toBeDefined();
      expect(cp2!.connection!.pipeId).toBe("P1");
    });

    it("handles GeoJSONL with no pipe connections", () => {
      const geoJsonL =
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {"name": "Customer 1"}}';

      const { spatialIndex, assets } = createEmptySpatialIndex();
      const result = parseStreamingFromFile(geoJsonL, spatialIndex, assets, 1);

      expect(result.customerPoints.size).toBe(0);
      expect(result.issues).toBeDefined();
      expect(result.issues!.skippedNoValidJunction).toBe(1);
    });

    it("skips metadata lines", () => {
      const geoJsonL = [
        '{"type": "metadata", "version": "1.0"}',
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {"name": "Customer 1"}}',
      ].join("\n");

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(geoJsonL, spatialIndex, assets, 1);

      expect(result.customerPoints.size).toBe(1);
      expect(result.issues).toBeNull();
    });

    it("skips non-Point geometries in GeoJSONL", () => {
      const geoJsonL = [
        '{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}, "properties": {}}',
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {}}',
      ].join("\n");

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(geoJsonL, spatialIndex, assets, 1);

      expect(result.customerPoints.size).toBe(1);
      expect(result.issues).toBeDefined();
      expect(result.issues!.skippedNonPointFeatures).toBe(1);
    });

    it("handles invalid JSON lines", () => {
      const geoJsonL = [
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {}}',
        "invalid json line",
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [7, 2]}, "properties": {}}',
      ].join("\n");

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(geoJsonL, spatialIndex, assets, 1);

      expect(result.customerPoints.size).toBe(2);
      expect(result.issues).toBeDefined();
      expect(result.issues!.skippedInvalidLines).toBe(1);
    });

    it("handles empty lines", () => {
      const geoJsonL = [
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {}}',
        "",
        "   ",
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [7, 2]}, "properties": {}}',
      ].join("\n");

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(geoJsonL, spatialIndex, assets, 1);

      expect(result.customerPoints.size).toBe(2);
      expect(result.issues).toBeNull();
    });
  });

  describe("ID assignment", () => {
    it("assigns sequential IDs starting from provided startingId", () => {
      const geoJsonL = [
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {}}',
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [7, 2]}, "properties": {}}',
      ].join("\n");

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        geoJsonL,
        spatialIndex,
        assets,
        100,
      );

      expect(result.customerPoints.size).toBe(2);
      expect(result.customerPoints.has("100")).toBe(true);
      expect(result.customerPoints.has("101")).toBe(true);
    });

    it("defaults to starting ID 1", () => {
      const geoJsonL =
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {}}';

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(geoJsonL, spatialIndex, assets);

      expect(result.customerPoints.size).toBe(1);
      expect(result.customerPoints.has("1")).toBe(true);
    });
  });

  describe("Properties preservation", () => {
    it("extracts demand property and filters out other properties", () => {
      const originalProperties = {
        name: "Test Customer",
        demand: 100,
        type: "residential",
      };
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5, 1],
            },
            properties: originalProperties,
          },
        ],
      };

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      const customerPoint = result.customerPoints.get("1");
      expect(customerPoint!.baseDemand).toBe(100);
      expect(customerPoint!.connection).toBeDefined();
    });

    it("handles missing properties", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5, 1],
            },
          },
        ],
      };

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      const customerPoint = result.customerPoints.get("1");
      expect(customerPoint!.baseDemand).toBe(0);
    });
  });

  describe("Connection verification", () => {
    it("connects to multiple different pipes correctly", () => {
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

      const geoJsonL = [
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [5, 1]}, "properties": {}}', // Should connect to P1
        '{"type": "Feature", "geometry": {"type": "Point", "coordinates": [1, 5]}, "properties": {}}', // Should connect to P2
      ].join("\n");

      const result = parseStreamingFromFile(
        geoJsonL,
        spatialIndexData,
        assets,
        1,
      );

      expect(result.customerPoints.size).toBe(2);

      const cp1 = result.customerPoints.get("1");
      expect(cp1!.connection!.pipeId).toBe("P1");

      const cp2 = result.customerPoints.get("2");
      expect(cp2!.connection!.pipeId).toBe("P2");
    });

    it("includes connection distance and snap point", () => {
      const geoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [5, 1],
            },
            properties: {},
          },
        ],
      };

      const { spatialIndex, assets } = createTestSpatialIndex();
      const result = parseStreamingFromFile(
        JSON.stringify(geoJson),
        spatialIndex,
        assets,
        1,
      );

      const customerPoint = result.customerPoints.get("1");
      expect(customerPoint!.connection).toBeDefined();
      expect(customerPoint!.connection!.distance).toBeGreaterThan(0);
      expect(customerPoint!.connection!.snapPoint).toBeDefined();
      expect(customerPoint!.connection!.snapPoint).toHaveLength(2);
    });
  });
});
