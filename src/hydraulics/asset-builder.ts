import { QuantityMap } from "src/quantity";
import {
  AssetQuantitiesSpecByType,
  Junction,
  canonicalQuantitiesSpec,
} from "./asset-types";
import { JunctionBuildData, JunctionQuantities } from "./asset-types/junction";
import { AssetQuantitiesSpec } from "./asset-types/asset-quantities";
import { Pipe, PipeBuildData, PipeQuantities } from "./asset-types/pipe";

export class AssetBuilder {
  private quantitiesSpec: AssetQuantitiesSpecByType;

  constructor(quantitiesSpec = canonicalQuantitiesSpec) {
    this.quantitiesSpec = quantitiesSpec;
  }

  buildPipe(data: PipeBuildData = {}) {
    const pipeSpec = this.quantitiesSpec
      .pipe as AssetQuantitiesSpec<PipeQuantities>;

    const defaultQuantities = Object.keys(pipeSpec).reduce((acc, key) => {
      const typedKey = key as keyof PipeQuantities;
      acc[typedKey] = {
        value: pipeSpec[typedKey].defaultValue,
        unit: pipeSpec[typedKey].unit,
      };
      return acc;
    }, {} as QuantityMap<PipeQuantities>);

    return Pipe.build({ ...defaultQuantities, ...data });
  }

  buildJunction(data: JunctionBuildData = {}) {
    const junctionSpec = this.quantitiesSpec
      .junction as AssetQuantitiesSpec<JunctionQuantities>;

    const defaultQuantities = Object.keys(junctionSpec).reduce((acc, key) => {
      const typedKey = key as keyof JunctionQuantities;
      acc[typedKey] = {
        value: junctionSpec[typedKey].defaultValue,
        unit: junctionSpec[typedKey].unit,
      };
      return acc;
    }, {} as QuantityMap<JunctionQuantities>);

    return Junction.build({ ...defaultQuantities, ...data });
  }
}
