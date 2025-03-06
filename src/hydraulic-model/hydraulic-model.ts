import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder, DefaultQuantities } from "./asset-builder";
import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { nanoid } from "nanoid";
import { HeadlossFormula } from "./asset-types/pipe";
import { IdGenerator } from "./id-generator";
import { LabelManager } from "./label-manager";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  assetBuilder: AssetBuilder;
  topology: Topology;
  units: UnitsSpec;
  headlossFormula: HeadlossFormula;
  labelManager: LabelManager;
};

export { AssetsMap };

export const initializeHydraulicModel = ({
  units,
  defaults,
  headlossFormula = "H-W",
}: {
  units: UnitsSpec;
  defaults: DefaultQuantities;
  headlossFormula?: HeadlossFormula;
}) => {
  const labelManager = new LabelManager();
  return {
    version: nanoid(),
    assets: new Map(),
    assetBuilder: new AssetBuilder(
      units,
      defaults,
      new IdGenerator(),
      labelManager,
    ),
    topology: new Topology(),
    units,
    labelManager,
    headlossFormula,
  };
};
