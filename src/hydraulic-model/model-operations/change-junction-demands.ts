import { AssetId } from "../asset-types";
import { Junction } from "../asset-types/junction";
import { JunctionDemand } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = {
  junctionId: AssetId;
  demands: JunctionDemand[];
};

export const changeJunctionDemands: ModelOperation<InputData> = (
  { assets },
  { junctionId, demands },
) => {
  const junction = assets.get(junctionId);
  if (!junction) throw new Error(`Invalid junction id ${junctionId}`);
  if (junction.type !== "junction") {
    throw new Error(`Asset ${junctionId} is not a junction`);
  }

  const updatedJunction = (junction as Junction).copy();
  updatedJunction.setDemands(demands);

  return {
    note: "Change junction demands",
    putAssets: [updatedJunction],
  };
};
