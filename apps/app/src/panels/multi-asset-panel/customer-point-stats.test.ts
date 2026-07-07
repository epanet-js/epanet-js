import { describe, it, expect } from "vitest";
import {
  computeCustomerPointsStats,
  computeCustomerPointsSummary,
} from "./customer-point-stats";
import type {
  PropertyStats,
  BooleanStats,
  LiteralCategoryStats,
  QuantityStats,
} from "./stats";
import type {
  PropertyStats as SummaryPropertyStats,
  BooleanStats as BooleanSummary,
  LiteralCategoryStats as LiteralCategorySummary,
  QuantityStats as QuantitySummary,
} from "./summary-stats";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  presets,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";

describe("computeCustomerPointData", () => {
  const units = presets.LPS.units;
  const formatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };

  const findStat = <T extends PropertyStats>(
    stats: PropertyStats[],
    property: string,
  ): T => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    return stat as T;
  };

  const IDS = {
    J1: 1,
    P1: 2,
    CP1: 101,
    CP2: 102,
    CP3: 103,
    CP4: 104,
    RESIDENTIAL: 201,
    COMMERCIAL: 202,
  } as const;

  const baseModel = () =>
    HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J1 + 1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J1 + 1 })
      .aDemandPattern(IDS.RESIDENTIAL, "Residential", [0.5, 1.5])
      .aDemandPattern(IDS.COMMERCIAL, "Commercial", [2]);

  it("returns empty stats for empty selection", async () => {
    const model = baseModel().build();
    const result = await computeCustomerPointsStats(
      [],
      model.demands,
      model.patterns,
      units,
      formatting,
    );
    expect(result.connections).toEqual([]);
    expect(result.demands).toEqual([]);
  });

  it("groups CPs by connection status", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1, {
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPoint(IDS.CP2, {
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPoint(IDS.CP3)
      .build();

    const result = await computeCustomerPointsStats(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const connected = findStat<BooleanStats>(result.connections, "connected");
    expect(connected.values.get("yes")).toEqual([IDS.CP1, IDS.CP2]);
    expect(connected.values.get("no")).toEqual([IDS.CP3]);
  });

  it("buckets demandsCount per CP", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 1 }])
      .aCustomerPoint(IDS.CP2)
      .aCustomerPointDemand(IDS.CP2, [{ baseDemand: 1 }, { baseDemand: 2 }])
      .aCustomerPoint(IDS.CP3)
      .build();

    const result = await computeCustomerPointsStats(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const demandsCount = findStat<QuantityStats>(
      result.demands,
      "demandsCount",
    );
    expect(demandsCount.values.get(1)).toEqual([IDS.CP1]);
    expect(demandsCount.values.get(2)).toEqual([IDS.CP2]);
    expect(demandsCount.values.get(0)).toEqual([IDS.CP3]);
    expect(demandsCount.isInteger).toBe(true);
  });

  it("places each CP at most once per pattern bucket", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [
        { baseDemand: 1, patternId: IDS.RESIDENTIAL },
        { baseDemand: 2, patternId: IDS.RESIDENTIAL },
      ])
      .aCustomerPoint(IDS.CP2)
      .aCustomerPointDemand(IDS.CP2, [
        { baseDemand: 1, patternId: IDS.RESIDENTIAL },
        { baseDemand: 1, patternId: IDS.COMMERCIAL },
      ])
      .build();

    const result = await computeCustomerPointsStats(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const patterns = findStat<LiteralCategoryStats>(
      result.demands,
      "customerPattern",
    );
    expect(patterns.values.get("Residential")).toEqual([IDS.CP1, IDS.CP2]);
    expect(patterns.values.get("Commercial")).toEqual([IDS.CP2]);
    expect(patterns.emptyBucket).toBeUndefined();
  });

  it("places unpatterned and demandless CPs in the constant bucket", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 4 }])
      .aCustomerPoint(IDS.CP2)
      .aCustomerPointDemand(IDS.CP2, [
        { baseDemand: 1, patternId: IDS.RESIDENTIAL },
        { baseDemand: 2 },
      ])
      .aCustomerPoint(IDS.CP3)
      .build();

    const result = await computeCustomerPointsStats(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const patterns = findStat<LiteralCategoryStats>(
      result.demands,
      "customerPattern",
    );
    expect(patterns.emptyBucket?.label).toBe("constant");
    expect(patterns.emptyBucket?.ids).toEqual([IDS.CP1, IDS.CP2]);
    expect(patterns.values.get("Residential")).toEqual([IDS.CP2]);
  });

  it("computes time-averaged customerDemand using pattern multipliers", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [
        { baseDemand: 10, patternId: IDS.RESIDENTIAL },
      ])
      .aCustomerPoint(IDS.CP2)
      .aCustomerPointDemand(IDS.CP2, [
        { baseDemand: 5, patternId: IDS.COMMERCIAL },
      ])
      .aCustomerPoint(IDS.CP3)
      .aCustomerPointDemand(IDS.CP3, [{ baseDemand: 4 }])
      .aCustomerPoint(IDS.CP4)
      .build();

    const result = await computeCustomerPointsStats(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const customerDemand = findStat<QuantityStats>(
      result.demands,
      "customerDemand",
    );
    expect(customerDemand.unit).toBe(units.customerDemandPerDay);
    const SECONDS_PER_DAY = 86400;
    expect(customerDemand.values.get(10 * SECONDS_PER_DAY)).toEqual([
      IDS.CP1,
      IDS.CP2,
    ]);
    expect(customerDemand.values.get(4 * SECONDS_PER_DAY)).toEqual([IDS.CP3]);
    expect(customerDemand.values.get(0)).toEqual([IDS.CP4]);
  });
});

describe("computeCustomerPointsSummary", () => {
  const units = presets.LPS.units;
  const formatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };

  const findStat = <T extends SummaryPropertyStats>(
    stats: SummaryPropertyStats[],
    property: string,
  ): T => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    return stat as T;
  };

  const IDS = {
    J1: 1,
    P1: 2,
    CP1: 101,
    CP2: 102,
    CP3: 103,
    RESIDENTIAL: 201,
    COMMERCIAL: 202,
  } as const;

  const baseModel = () =>
    HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J1 + 1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J1 + 1 })
      .aDemandPattern(IDS.RESIDENTIAL, "Residential", [0.5, 1.5])
      .aDemandPattern(IDS.COMMERCIAL, "Commercial", [2]);

  it("summarizes connection status without retaining ids", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1, {
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPoint(IDS.CP2)
      .build();

    const result = await computeCustomerPointsSummary(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const connected = findStat<BooleanSummary>(result.connections, "connected");
    expect(connected.type).toBe("boolean");
    expect(connected.distinctCount).toBe(2);
    expect(connected).not.toHaveProperty("values");
  });

  it("reports a single demandsCount value when all agree", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 1 }])
      .aCustomerPoint(IDS.CP2)
      .aCustomerPointDemand(IDS.CP2, [{ baseDemand: 2 }])
      .build();

    const result = await computeCustomerPointsSummary(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const demandsCount = findStat<QuantitySummary>(
      result.demands,
      "demandsCount",
    );
    expect(demandsCount.distinctCount).toBe(1);
    expect(demandsCount.singleValue).toBe(1);
    expect(demandsCount.isInteger).toBe(true);
  });

  it("keeps distinct pattern labels and counts the constant bucket", async () => {
    const model = baseModel()
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [
        { baseDemand: 1, patternId: IDS.RESIDENTIAL },
      ])
      .aCustomerPoint(IDS.CP2)
      .aCustomerPointDemand(IDS.CP2, [
        { baseDemand: 1, patternId: IDS.COMMERCIAL },
      ])
      .aCustomerPoint(IDS.CP3)
      .aCustomerPointDemand(IDS.CP3, [{ baseDemand: 2 }])
      .build();

    const result = await computeCustomerPointsSummary(
      Array.from(model.customerPoints.values()),
      model.demands,
      model.patterns,
      units,
      formatting,
    );

    const patterns = findStat<LiteralCategorySummary>(
      result.demands,
      "customerPattern",
    );
    expect([...patterns.distinctValues].sort()).toEqual([
      "Commercial",
      "Residential",
    ]);
    expect(patterns.emptyBucket?.label).toBe("constant");
    expect(patterns.emptyBucket?.count).toBe(1);
    expect(patterns.emptyBucket).not.toHaveProperty("ids");
  });
});
