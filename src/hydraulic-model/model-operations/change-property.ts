import { Asset, AssetId } from "../asset-types";
import { PumpDefintionType, PumpStatus } from "../asset-types/pump";
import { ValveStatus } from "../asset-types/valve";
import { ModelOperation } from "../model-operation";

type InputData = {
  assetIds: AssetId[];
  property: string;
  value: number | PumpStatus | PumpDefintionType | ValveStatus;
};

export const changeProperty: ModelOperation<InputData> = (
  { assets },
  { assetIds, property, value },
) => {
  const updatedAssets: Asset[] = [];
  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    if (!asset.hasProperty(property)) continue;

    const updatedAsset = asset.copy();
    updatedAsset.setProperty(property, value);
    updatedAssets.push(updatedAsset);
  }

  return { note: "Change asset property", putAssets: updatedAssets };
};
