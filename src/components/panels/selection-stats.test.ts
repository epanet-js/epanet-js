import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Asset } from "src/hydraulic-model";

type QuantityStats = {
  type: "quantity";
  property: string;
  sum: number;
  max: number;
  min: number;
  mean: number;
  values: Map<number, number>;
};

const computeStats = (assets: Asset[]): Map<string, QuantityStats> => {
  const statsMap = new Map<string, QuantityStats>();
  for (const asset of assets) {
    const properties = asset.listProperties();
    for (const property of properties) {
      const value = asset.getProperty(property) as unknown as number;
      if (!statsMap.has(property)) {
        statsMap.set(property, {
          type: "quantity",
          property,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          mean: 0,
          values: new Map(),
        });
      }

      const propertyStats = statsMap.get(property) as QuantityStats;

      if (value < propertyStats.min) propertyStats.min = value;
      if (value > propertyStats.max) propertyStats.max = value;

      propertyStats.sum += value;

      propertyStats.values.set(
        value,
        (propertyStats.values.get(value) || 0) + 1,
      );

      propertyStats.mean = propertyStats.sum / propertyStats.values.size;
    }
  }

  return statsMap;
};

describe("Selection stats", () => {
  it("can compute stats of a quantity", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 10 })
      .aJunction("J2", { elevation: 20 })
      .aJunction("J3", { elevation: 20 })
      .aReservoir("R1", { elevation: 30 })
      .build();
    const selection = [...assets.values()];

    const statsMap = computeStats(selection);
    const propertyStats = statsMap.get("elevation") as QuantityStats;

    expect(propertyStats.type).toEqual("quantity");
    expect(propertyStats.property).toEqual("elevation");
    expect(propertyStats.sum).toEqual(80);
    expect(propertyStats.min).toEqual(10);
    expect(propertyStats.max).toEqual(30);
    expect(propertyStats.mean).toBeCloseTo(26.666);
    expect(propertyStats.values.get(10)).toEqual(1);
    expect(propertyStats.values.get(20)).toEqual(2);
  });

  it("can compute multiple properties", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 10, demand: 20 })
      .aReservoir("R1", { elevation: 30 })
      .build();
    const selection = [...assets.values()];

    const statsMap = computeStats(selection);

    expect(statsMap.get("demand")!.values.get(20)).toEqual(1);
    expect([...statsMap.get("elevation")!.values.keys()]).toEqual([10, 30]);
  });
});
