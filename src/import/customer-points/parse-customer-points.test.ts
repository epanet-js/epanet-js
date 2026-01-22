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
      expect(customerPoint!.demands[0].patternLabel).toBeUndefined();
    });

    it("creates customer points with patternId when provided", () => {
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
          "pattern-1",
        ),
      );

      expect(results).toHaveLength(1);
      const customerPoint = results[0];
      expect(customerPoint).not.toBeNull();
      expect(customerPoint!.demands).toHaveLength(1);
      expect(customerPoint!.demands[0].patternLabel).toBe("pattern-1");
    });

    it("applies patternId to all customer points when parsing multiple features", () => {
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
          "daily-pattern",
        ),
      );

      expect(results).toHaveLength(3);
      results.forEach((customerPoint) => {
        expect(customerPoint).not.toBeNull();
        expect(customerPoint!.demands[0].patternLabel).toBe("daily-pattern");
      });
    });

    it("applies patternId when parsing GeoJSONL format", () => {
      const geoJsonL = `{"type":"Feature","geometry":{"type":"Point","coordinates":[0.001,0.001]},"properties":{"demand":100}}
{"type":"Feature","geometry":{"type":"Point","coordinates":[0.002,0.002]},"properties":{"demand":200}}`;

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
          "weekly-pattern",
        ),
      );

      expect(results).toHaveLength(2);
      results.forEach((customerPoint) => {
        expect(customerPoint).not.toBeNull();
        expect(customerPoint!.demands[0].patternLabel).toBe("weekly-pattern");
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
      expect(customerPoint!.demands[0].patternLabel).toBeUndefined();
    });
  });
});
