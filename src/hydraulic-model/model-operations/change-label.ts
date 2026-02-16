import { AssetId } from "../asset-types";
import type { AssetPatch } from "../model-operation";
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

  return {
    note: "Change asset label",
    patchAssetsAttributes: [
      {
        id: assetId,
        type: asset.type,
        properties: { label: newLabel },
      } as AssetPatch,
    ],
  };
};
