import type { Feature } from "geojson";
import type {
  CustomAttributePlan,
  CustomerPointData,
} from "@epanet-js/converters";
import { CustomerPointFactory, LabelManager } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { CustomerPointsIssuesAccumulator } from "./issues";
import { buildCustomerPoints } from "./build-customer-points";

const aRecord = (
  ref: string,
  coordinates: [number, number],
  demands?: CustomerPointData["demands"],
): CustomerPointData => ({ ref, coordinates, ...(demands ? { demands } : {}) });

const aFeature = (coordinates: [number, number]): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: {},
});

const build = async (
  records: CustomerPointData[],
  features: Feature[],
  overrides: Partial<{
    patternId: number | null;
    defaultDemand: number | null;
    toDemand: (value: number) => number;
    attributes: CustomAttributePlan;
    createLimit: number;
    onProgress: (processed: number, total: number) => void;
  }> = {},
) => {
  const issues = new CustomerPointsIssuesAccumulator();
  const result = await buildCustomerPoints(records, features, {
    factory: new CustomerPointFactory(
      new ConsecutiveIdsGenerator(),
      new LabelManager(),
    ),
    toDemand: overrides.toDemand ?? ((value) => value),
    patternId: overrides.patternId ?? null,
    defaultDemand:
      overrides.defaultDemand === undefined ? null : overrides.defaultDemand,
    attributes: overrides.attributes,
    createLimit: overrides.createLimit,
    onProgress: overrides.onProgress,
    issues,
  });
  return { ...result, issues: issues.buildResult() };
};

describe("buildCustomerPoints", () => {
  it("creates up to the limit but counts every valid record", async () => {
    const { customerPoints, demands, validCount } = await build(
      [
        aRecord("0", [0.001, 0.001]),
        aRecord("1", [432000, 5812000]),
        aRecord("2", [0.002, 0.002]),
        aRecord("3", [0.003, 0.003]),
      ],
      [
        aFeature([0.001, 0.001]),
        aFeature([432000, 5812000]),
        aFeature([0.002, 0.002]),
        aFeature([0.003, 0.003]),
      ],
      { createLimit: 2 },
    );

    expect(customerPoints.map(({ coordinates }) => coordinates)).toEqual([
      [0.001, 0.001],
      [0.002, 0.002],
    ]);
    expect(demands.size).toBe(2);
    expect(validCount).toBe(3);
  });

  it("reports progress through the records", async () => {
    const progress: [number, number][] = [];

    await build(
      [aRecord("0", [0.001, 0.001]), aRecord("1", [0.002, 0.002])],
      [aFeature([0.001, 0.001]), aFeature([0.002, 0.002])],
      { onProgress: (processed, total) => progress.push([processed, total]) },
    );

    expect(progress.at(-1)).toEqual([2, 2]);
  });

  it("skips records outside lat/lng, which is every projection we could not apply", async () => {
    const { customerPoints, issues } = await build(
      [aRecord("0", [432000, 5812000]), aRecord("1", [0.001, 0.001])],
      [aFeature([432000, 5812000]), aFeature([0.001, 0.001])],
    );

    expect(customerPoints).toHaveLength(1);
    expect(issues!.skippedInvalidProjection).toHaveLength(1);
  });

  it("falls back to the default demand when a record states none", async () => {
    const { customerPoints, demands } = await build(
      [aRecord("0", [0.001, 0.001])],
      [aFeature([0.001, 0.001])],
      { defaultDemand: 7 },
    );

    expect(demands.get(customerPoints[0].id)).toEqual([{ baseDemand: 7 }]);
  });

  it("leaves demands out when neither the record nor a default states one", async () => {
    const { customerPoints, demands } = await build(
      [aRecord("0", [0.001, 0.001])],
      [aFeature([0.001, 0.001])],
    );

    expect(demands.get(customerPoints[0].id)).toEqual([]);
  });

  it("converts the stated demand and attaches the pattern", async () => {
    const { customerPoints, demands } = await build(
      [aRecord("0", [0.001, 0.001], [{ baseDemand: 86400 }])],
      [aFeature([0.001, 0.001])],
      { patternId: 3, toDemand: (value) => value / 86400 },
    );

    expect(demands.get(customerPoints[0].id)).toEqual([
      { baseDemand: 1, patternId: 3 },
    ]);
  });

  it("stores planned custom attributes under their ids", async () => {
    const { customerPoints } = await build(
      [
        {
          ...aRecord("0", [0.001, 0.001]),
          customAttributes: { ZONE: "NORTH", UNPLANNED: "ignored" },
        },
      ],
      [aFeature([0.001, 0.001])],
      { attributes: new Map([["ZONE", { id: "custom-1", type: "text" }]]) },
    );

    expect(customerPoints[0].getProperty("custom-1")).toBe("NORTH");
    expect(customerPoints[0].hasProperty("UNPLANNED")).toBe(false);
  });
});
