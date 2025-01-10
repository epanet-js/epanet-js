import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Asset } from "src/hydraulic-model";

type QuantityStats = {
  type: "quantity";
  property: string;
  sum: number;
  max: number;
  min: number;
  mean: number;
  values: number[];
};

const computeStats = (assets: Asset[]): Map<string, QuantityStats> => {
  const property = "elevation";
  const statsMap = new Map<string, QuantityStats>();
  for (const asset of assets) {
    if (!asset.hasProperty(property)) continue;
    if (!statsMap.has(property)) {
      statsMap.set(property, {
        type: "quantity",
        property,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        mean: 0,
        values: [],
      });
    }

    const propertyStats = statsMap.get(property) as QuantityStats;
    const value = asset.getProperty(property) as unknown as number;

    if (value < propertyStats.min) propertyStats.min = value;
    if (value > propertyStats.max) propertyStats.max = value;

    propertyStats.sum += value;
    propertyStats.values.push(value);

    propertyStats.mean = propertyStats.sum / propertyStats.values.length;
  }

  return statsMap;
};

describe("Selection stats", () => {
  it("computes stats of a property", () => {
    const { assets } = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 10 })
      .aJunction("J2", { elevation: 20 })
      .aReservoir("R1", { elevation: 30 })
      .build();
    const selection = [...assets.values()];

    const statsMap = computeStats(selection);

    const propertyStats = statsMap.get("elevation") as QuantityStats;

    expect(propertyStats.type).toEqual("quantity");
    expect(propertyStats.property).toEqual("elevation");
    expect(propertyStats.values).toEqual([10, 20, 30]);
    expect(propertyStats.sum).toEqual(60);
    expect(propertyStats.min).toEqual(10);
    expect(propertyStats.max).toEqual(30);
    expect(propertyStats.mean).toEqual(20);
  });
});
