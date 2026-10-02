import { AssetId } from "@epanet-js/hydraulic-model";
import type { AssetPatch } from "../model-operation";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
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

export const changeLabelDeprecated: ModelOperationDeprecated<InputData> = (
  { assets },
  { assetId, newLabel },
) => {
  const asset = assets.get(assetId);
  if (!asset) throw new Error(`Invalid asset id ${assetId}`);

  return {
    note: "changeLabel",
    patchAssetsAttributes: [
      {
        id: assetId,
        type: asset.type,
        properties: { label: newLabel },
      } as AssetPatch,
    ],
  };
};
