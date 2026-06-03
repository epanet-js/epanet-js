import { parseCustomerPoints } from "./parse-customer-points";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { CustomerPointFactory, LabelManager } from "@epanet-js/hydraulic-model";

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
        parseCustomerPoints(
          geoJson,
          issues,
          "l/d",
          "l/d",
          new CustomerPointFactory(
            new ConsecutiveIdsGenerator(),
            new LabelManager(),
          ),
          "demand",
          null,
          null,
        ),
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
          new CustomerPointFactory(
            new ConsecutiveIdsGenerator(),
            new LabelManager(),
          ),
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
          new CustomerPointFactory(
            new ConsecutiveIdsGenerator(),
            new LabelManager(),
          ),
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
          new CustomerPointFactory(
            new ConsecutiveIdsGenerator(),
            new LabelManager(),
          ),
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

  describe("default demand", () => {
    it("applies the default demand to every point when no property is given", () => {
      const geoJson = JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.001, 0.001] },
            properties: { name: "A" },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.002, 0.002] },
            properties: { name: "B" },
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
          new CustomerPointFactory(
            new ConsecutiveIdsGenerator(),
            new LabelManager(),
          ),
          null,
          null,
          null,
          42,
        ),
      );

      expect(results).toHaveLength(2);
      results.forEach((parsed) => {
        expect(parsed).not.toBeNull();
        expect(parsed!.demands[0].baseDemand).toBe(42);
      });
      expect(issues.buildResult()?.skippedInvalidDemands).toBeUndefined();
    });

    it("ignores missing/invalid demand attribute values when no property is given", () => {
      const geoJson = JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.001, 0.001] },
            properties: { demand: "not-a-number" },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.002, 0.002] },
            properties: {},
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
          new CustomerPointFactory(
            new ConsecutiveIdsGenerator(),
            new LabelManager(),
          ),
          null,
          null,
          null,
          7,
        ),
      );

      expect(results).toHaveLength(2);
      results.forEach((parsed) => {
        expect(parsed).not.toBeNull();
        expect(parsed!.demands[0].baseDemand).toBe(7);
      });
      expect(issues.buildResult()?.skippedInvalidDemands).toBeUndefined();
    });
  });

  describe("default demand fallback for selected attribute", () => {
    const makeFeatures = (
      values: Array<unknown>,
    ): { type: "FeatureCollection"; features: unknown[] } => ({
      type: "FeatureCollection",
      features: values.map((v, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [0.001 * (i + 1), 0.001] },
        properties: v === undefined ? {} : { demand: v },
      })),
    });

    const parse = (geoJson: unknown, defaultDemand: number | null) => {
      const issues = new CustomerPointsIssuesAccumulator();
      const results = Array.from(
        parseCustomerPoints(
          JSON.stringify(geoJson),
          issues,
          "l/d",
          "l/d",
          new CustomerPointFactory(
            new ConsecutiveIdsGenerator(),
            new LabelManager(),
          ),
          "demand",
          null,
          null,
          defaultDemand,
        ),
      );
      return { results, issues };
    };

    it("falls back to the default value when the attribute is missing/null/undefined", () => {
      const geoJson = makeFeatures([10, null, undefined, 30]);

      const { results, issues } = parse(geoJson, 99);

      expect(results).toHaveLength(4);
      expect(results[0]!.demands[0].baseDemand).toBe(10);
      expect(results[1]!.demands[0].baseDemand).toBe(99);
      expect(results[2]!.demands[0].baseDemand).toBe(99);
      expect(results[3]!.demands[0].baseDemand).toBe(30);
      expect(issues.buildResult()?.skippedInvalidDemands).toHaveLength(2);
    });

    it("falls back to the default value when the attribute is a boolean or non-numeric string", () => {
      const geoJson = makeFeatures([true, "not-a-number"]);

      const { results, issues } = parse(geoJson, 5);

      expect(results).toHaveLength(2);
      results.forEach((parsed) => {
        expect(parsed).not.toBeNull();
        expect(parsed!.demands[0].baseDemand).toBe(5);
      });
      expect(issues.buildResult()?.skippedInvalidDemands).toHaveLength(2);
    });

    it("skips invalid values when defaultDemand is null (legacy behavior)", () => {
      const geoJson = makeFeatures([10, null, "bad", true]);

      const { results, issues } = parse(geoJson, null);

      expect(results[0]).not.toBeNull();
      expect(results[0]!.demands[0].baseDemand).toBe(10);
      expect(results[1]).toBeNull();
      expect(results[2]).toBeNull();
      expect(results[3]).toBeNull();
      expect(issues.buildResult()?.skippedInvalidDemands).toHaveLength(3);
    });
  });
});
