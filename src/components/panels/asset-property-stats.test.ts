import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  CategoryStats,
  QuantityStats,
  computePropertyStats,
} from "./asset-property-stats";
import { Quantities, presets } from "src/model-metadata/quantities-spec";

const defaultQuantities = new Quantities(presets.LPS);

describe("Asset property stats", () => {
  it("can compute stats of a quantity", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 10 })
      .aJunction("J2", { elevation: 20 })
      .aJunction("J3", { elevation: 20 })
      .aReservoir("R1", { elevation: 30 })
      .build();
    const selection = [...assets.values()];

    const statsMap = computePropertyStats(selection, defaultQuantities);
    const propertyStats = statsMap.get("elevation") as QuantityStats;

    expect(propertyStats.type).toEqual("quantity");
    expect(propertyStats.property).toEqual("elevation");
    expect(propertyStats.sum).toEqual(80);
    expect(propertyStats.min).toEqual(10);
    expect(propertyStats.max).toEqual(30);
    expect(propertyStats.mean).toBeCloseTo(20);
    expect(propertyStats.values.get(10)).toEqual(1);
    expect(propertyStats.values.get(20)).toEqual(2);
  });

  it("can compute stats for categories", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aPipe("J3")
      .aReservoir("R1")
      .build();
    const selection = [...assets.values()];

    const statsMap = computePropertyStats(selection, defaultQuantities);
    const propertyStats = statsMap.get("type") as CategoryStats;

    expect(propertyStats.type).toEqual("category");
    expect(propertyStats.values.get("junction")).toEqual(2);
    expect(propertyStats.values.get("pipe")).toEqual(1);
    expect(propertyStats.values.get("reservoir")).toEqual(1);
  });

  it("can compute multiple properties", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 10, demand: 20 })
      .aReservoir("R1", { elevation: 30 })
      .build();
    const selection = [...assets.values()];

    const statsMap = computePropertyStats(selection, defaultQuantities);

    expect((statsMap.get("demand") as QuantityStats).values.get(20)).toEqual(1);
    expect([...statsMap.get("elevation")!.values.keys()]).toEqual([10, 30]);
  });

  it("applies rounding to simulation quantities", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { simulation: { pressure: 0.00001 } })
      .aJunction("J2", { simulation: { pressure: 2.3449 } })
      .aJunction("J3", { simulation: { pressure: -0.00001 } })
      .build();
    const selection = [...assets.values()];
    const quantities = new Quantities(presets.LPS);

    const statsMap = computePropertyStats(selection, quantities);

    const propertyStats = statsMap.get("pressure") as QuantityStats;
    expect(propertyStats.values.get(2.345)).toEqual(1);
    expect(propertyStats.values.get(0)).toEqual(2);
    expect(propertyStats.min).toEqual(0);
    expect(propertyStats.max).toEqual(2.345);
    expect(propertyStats.mean).toEqual(0.782);
    expect(propertyStats.sum).toEqual(2.345);
  });

  it("ignores private props", () => {
    const { assets } = HydraulicModelBuilder.with().aPipe("P1").build();
    const selection = [...assets.values()];

    const statsMap = computePropertyStats(selection, defaultQuantities);

    expect(statsMap.get("connections")).toBeFalsy();
  });

  it.skip("is performant", () => {
    const total = 1e6;
    const builder = HydraulicModelBuilder.with();
    for (let i = 0; i < total; i++) {
      builder.aJunction(String(i));
    }
    const { assets } = builder.build();

    const start = performance.now();

    computePropertyStats([...assets.values()], defaultQuantities);
    // eslint-disable-next-line no-console
    console.log(
      `Time spent to compute stats: ${(performance.now() - start).toFixed(2)}ms`,
    );
  });
});
