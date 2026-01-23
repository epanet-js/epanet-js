import { parseCustomerPoints } from "./parse-customer-points";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";

describe("parseCustomerPoints", () => {
  describe("patternId", () => {
    it("creates customer points without patternId when not provided", () => {
      const geoJson = JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.001, 0.001] },
            properties: { demand: 100 },
          },
        ],
      });

      const issues = new CustomerPointsIssuesAccumulator();
      const results = Array.from(
        parseCustomerPoints(geoJson, issues, "l/d", "l/d", 1, "demand", null),
      );

      expect(results).toHaveLength(1);
      const customerPoint = results[0];
      expect(customerPoint).not.toBeNull();
      expect(customerPoint!.demands).toHaveLength(1);
      expect(customerPoint!.demands[0].patternId).toBeUndefined();
    });

    it("applies patternId to all customer points", () => {
      const geoJson = JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.001, 0.001] },
            properties: { demand: 100 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.002, 0.002] },
            properties: { demand: 200 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.003, 0.003] },
            properties: { demand: 300 },
          },
        ],
      });
      const PATTERN_ID = 2;

      const issues = new CustomerPointsIssuesAccumulator();
      const results = Array.from(
        parseCustomerPoints(
          geoJson,
          issues,
          "l/d",
          "l/d",
          1,
          "demand",
          null,
          PATTERN_ID,
        ),
      );

      expect(results).toHaveLength(3);
      results.forEach((customerPoint) => {
        expect(customerPoint).not.toBeNull();
        expect(customerPoint!.demands[0].patternId).toBe(PATTERN_ID);
      });
    });

    it("applies patternId when parsing GeoJSONL format", () => {
      const geoJsonL = `{"type":"Feature","geometry":{"type":"Point","coordinates":[0.001,0.001]},"properties":{"demand":100}}
{"type":"Feature","geometry":{"type":"Point","coordinates":[0.002,0.002]},"properties":{"demand":200}}`;

      const PATTERN_ID = 3;
      const issues = new CustomerPointsIssuesAccumulator();
      const results = Array.from(
        parseCustomerPoints(
          geoJsonL,
          issues,
          "l/d",
          "l/d",
          1,
          "demand",
          null,
          PATTERN_ID,
        ),
      );

      expect(results).toHaveLength(2);
      results.forEach((customerPoint) => {
        expect(customerPoint).not.toBeNull();
        expect(customerPoint!.demands[0].patternId).toBe(PATTERN_ID);
      });
    });

    it("applies null patternId correctly (no pattern)", () => {
      const geoJson = JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.001, 0.001] },
            properties: { demand: 100 },
          },
        ],
      });

      const issues = new CustomerPointsIssuesAccumulator();
      const results = Array.from(
        parseCustomerPoints(
          geoJson,
          issues,
          "l/d",
          "l/d",
          1,
          "demand",
          null,
          null,
        ),
      );

      expect(results).toHaveLength(1);
      const customerPoint = results[0];
      expect(customerPoint).not.toBeNull();
      expect(customerPoint!.demands[0].patternId).toBeUndefined();
    });
  });
});
