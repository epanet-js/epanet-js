import { AssetId } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, setAsset } from "../change-sets";

type InputData = {
  assetId: AssetId;
  newLabel: string;
};

export const changeLabel: ModelOperation<InputData> = (
  model,
  { assetId, newLabel },
) => {
  if (!model.assets.has(assetId)) {
    throw new Error(`Invalid asset id ${assetId}`);
  }

  return changeSet(model, "changeLabel", [
    setAsset(assetId, { label: newLabel }),
  ]);
};
