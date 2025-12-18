import { AssetId } from "../asset-types";
import { ModelOperation } from "../model-operation";

type InputData = {
  assetId: AssetId;
  newLabel: string;
};

export const changeLabel: ModelOperation<InputData> = (
  { assets },
  { assetId, newLabel },
) => {
  const asset = assets.get(assetId);
  if (!asset) throw new Error(`Invalid asset id ${assetId}`);

  const updatedAsset = asset.copy();
  updatedAsset.setProperty("label", newLabel);

  return { note: "Change asset label", putAssets: [updatedAsset] };
};
