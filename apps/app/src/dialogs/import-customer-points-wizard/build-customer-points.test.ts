import type { Feature } from "geojson";
import type { CustomerPointData } from "@epanet-js/converters";
import { createProjectionMapper } from "@epanet-js/projections";
import { CustomerPointFactory, LabelManager } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { CustomerPointsIssuesAccumulator } from "@epanet-js/gis-importers";
import { buildCustomerPoints, type Placement } from "./build-customer-points";

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

const xyGrid = (centroid: [number, number]): Placement => ({
  kind: "transform",
  toWgs84: createProjectionMapper({
    type: "xy-grid",
    id: "xy-grid",
    name: "XY Grid",
    centroid,
  }).toWgs84,
});

const build = (
  records: CustomerPointData[],
  features: Feature[],
  placement: Placement,
  overrides: Partial<{
    patternId: number | null;
    defaultDemand: number | null;
    toDemand: (value: number) => number;
  }> = {},
) => {
  const issues = new CustomerPointsIssuesAccumulator();
  const result = buildCustomerPoints(records, features, {
    factory: new CustomerPointFactory(
      new ConsecutiveIdsGenerator(),
      new LabelManager(),
    ),
    placement,
    toDemand: overrides.toDemand ?? ((value) => value),
    patternId: overrides.patternId ?? null,
    defaultDemand:
      overrides.defaultDemand === undefined ? null : overrides.defaultDemand,
    issues,
  });
  return { ...result, issues: issues.buildResult() };
};

describe("buildCustomerPoints", () => {
  it("places records with the project's transform, not the file's extent", () => {
    const placement = xyGrid([1000, 2000]);

    const alone = build(
      [aRecord("0", [1000, 2000])],
      [aFeature([1000, 2000])],
      placement,
    );
    const amongOthers = build(
      [aRecord("0", [1000, 2000]), aRecord("1", [500000, 900000])],
      [aFeature([1000, 2000]), aFeature([500000, 900000])],
      placement,
    );

    expect(alone.customerPoints[0].coordinates).toEqual(
      amongOthers.customerPoints[0].coordinates,
    );
    expect(alone.customerPoints[0].coordinates[0]).toBeCloseTo(0, 6);
    expect(alone.customerPoints[0].coordinates[1]).toBeCloseTo(0, 6);
  });

  it("skips records outside lat/lng when the project is georeferenced", () => {
    const { customerPoints, issues } = build(
      [aRecord("0", [432000, 5812000]), aRecord("1", [0.001, 0.001])],
      [aFeature([432000, 5812000]), aFeature([0.001, 0.001])],
      { kind: "wgs84" },
    );

    expect(customerPoints).toHaveLength(1);
    expect(issues!.skippedInvalidProjection).toHaveLength(1);
  });

  it("keeps the same records when the project is unprojected", () => {
    const { customerPoints, issues } = build(
      [aRecord("0", [432000, 5812000])],
      [aFeature([432000, 5812000])],
      xyGrid([432000, 5812000]),
    );

    expect(customerPoints).toHaveLength(1);
    expect(issues).toBeNull();
  });

  it("falls back to the default demand when a record states none", () => {
    const { customerPoints, demands } = build(
      [aRecord("0", [0.001, 0.001])],
      [aFeature([0.001, 0.001])],
      { kind: "wgs84" },
      { defaultDemand: 7 },
    );

    expect(demands.get(customerPoints[0].id)).toEqual([{ baseDemand: 7 }]);
  });

  it("leaves demands out when neither the record nor a default states one", () => {
    const { customerPoints, demands } = build(
      [aRecord("0", [0.001, 0.001])],
      [aFeature([0.001, 0.001])],
      { kind: "wgs84" },
    );

    expect(demands.get(customerPoints[0].id)).toEqual([]);
  });

  it("converts the stated demand and attaches the pattern", () => {
    const { customerPoints, demands } = build(
      [aRecord("0", [0.001, 0.001], [{ baseDemand: 86400 }])],
      [aFeature([0.001, 0.001])],
      { kind: "wgs84" },
      { patternId: 3, toDemand: (value) => value / 86400 },
    );

    expect(demands.get(customerPoints[0].id)).toEqual([
      { baseDemand: 1, patternId: 3 },
    ]);
  });
});
