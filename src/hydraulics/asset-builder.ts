import { QuantityMap } from "src/quantity";
import {
  AssetQuantitiesSpecByType,
  Junction,
  canonicalQuantitiesSpec,
} from "./asset-types";
import { JunctionBuildData } from "./asset-types/junction";
import { AssetQuantitiesSpec } from "./asset-types/asset-quantities";
import { Pipe, PipeBuildData } from "./asset-types/pipe";

export class AssetBuilder {
  private quantitiesSpec: AssetQuantitiesSpecByType;

  constructor(quantitiesSpec = canonicalQuantitiesSpec) {
    this.quantitiesSpec = quantitiesSpec;
  }

  buildPipe(data: PipeBuildData = {}) {
    const defaultQuantities = getDefaultQuantities(this.quantitiesSpec.pipe);

    return Pipe.build({ ...defaultQuantities, ...data });
  }

  buildJunction(data: JunctionBuildData = {}) {
    const defaultQuantities = getDefaultQuantities(
      this.quantitiesSpec.junction,
    );

    return Junction.build({ ...defaultQuantities, ...data });
  }
}

const getDefaultQuantities = <T>(
  quantitiesSpec: AssetQuantitiesSpec<T>,
): QuantityMap<T> => {
  return Object.keys(quantitiesSpec).reduce((acc, key) => {
    const typedKey = key as keyof T;
    acc[typedKey] = {
      value: quantitiesSpec[typedKey].defaultValue,
      unit: quantitiesSpec[typedKey].unit,
    };
    return acc;
  }, {} as QuantityMap<T>);
};
