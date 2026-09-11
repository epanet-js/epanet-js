import type { Feature } from "geojson";
import type { CustomerPointData } from "@epanet-js/converters";
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
    issues,
  });
  return { ...result, issues: issues.buildResult() };
};

describe("buildCustomerPoints", () => {
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
});
