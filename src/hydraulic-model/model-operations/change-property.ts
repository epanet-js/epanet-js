import { AssetId } from "../asset-types";
import { PumpDefintionType, PumpStatus } from "../asset-types/pump";
import { PipeStatus } from "../asset-types/pipe";
import { ValveStatus, ValveKind } from "../asset-types/valve";
import type { AssetPatch } from "../model-operation";
import { ModelOperation } from "../model-operation";

type InputData = {
  assetIds: AssetId[];
  property: string;
  value:
    | number
    | PumpStatus
    | PipeStatus
    | PumpDefintionType
    | ValveStatus
    | ValveKind
    | boolean;
};

export const changeProperty: ModelOperation<InputData> = (
  { assets },
  { assetIds, property, value },
) => {
  if (property === "isActive") {
    return { note: "Change asset property" };
  }

  const patches: AssetPatch[] = [];
  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    if (!asset.hasProperty(property)) continue;

    patches.push({
      id: assetId,
      type: asset.type,
      properties: { [property]: value },
    } as AssetPatch);
  }

  return { note: "Change asset property", patchAssetsAttributes: patches };
};
