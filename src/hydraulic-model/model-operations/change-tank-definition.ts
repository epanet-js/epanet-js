import { ModelOperation } from "../model-operation";
import { CurveId } from "../curves";
import { AssetId, Tank } from "../asset-types";

export type TankDefinitionData = {
  volumeCurveId: CurveId;
  minLevel: number;
  maxLevel: number;
};

type InputData = {
  tankId: AssetId;
  data: TankDefinitionData;
};

export const changeTankDefinition: ModelOperation<InputData> = (
  { assets },
  { tankId, data },
) => {
  const tank = assets.get(tankId) as Tank;
  if (!tank || tank.type !== "tank")
    throw new Error(`Invalid tank id ${tankId}`);

  const updatedTank = tank.copy();
  updatedTank.setProperty("volumeCurveId", data.volumeCurveId);
  updatedTank.setProperty("minLevel", data.minLevel);
  updatedTank.setProperty("maxLevel", data.maxLevel);

  return {
    note: "Change tank definition",
    putAssets: [updatedTank],
  };
};
