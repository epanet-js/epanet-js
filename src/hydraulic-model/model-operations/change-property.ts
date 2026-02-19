import { AssetId, AssetPropertiesMap } from "../asset-types";
import type { AssetPatch, ModelMoment } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";

type NonChangeableKeys = "type" | "connections";

type PatchableAssetProps = {
  [K in keyof AssetPropertiesMap]: Omit<
    AssetPropertiesMap[K],
    NonChangeableKeys
  >;
}[keyof AssetPropertiesMap];

type KeysOfUnion<U> = U extends unknown ? keyof U : never;
type ValueInUnion<U, K extends string> = U extends unknown
  ? K extends keyof U
    ? U[K]
    : never
  : never;

export type ChangeableProperty = KeysOfUnion<PatchableAssetProps>;

export type ChangeablePropertyValue<P extends ChangeableProperty> =
  ValueInUnion<PatchableAssetProps, P>;

export function changeProperty<P extends ChangeableProperty>(
  { assets }: HydraulicModel,
  {
    assetIds,
    property,
    value,
  }: {
    assetIds: AssetId[];
    property: P;
    value: ChangeablePropertyValue<P>;
  },
): ModelMoment {
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
}
