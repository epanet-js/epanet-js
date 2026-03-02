import { AssetId, AssetPropertiesMap } from "../asset-types";
import type { AssetPatch, ModelMoment } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { AssetsMap } from "../assets-map";

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

export type PropertyChange = {
  [P in ChangeableProperty]: {
    property: P;
    value: ChangeablePropertyValue<P>;
  };
}[ChangeableProperty];

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
  const patches = buildPatches(assets, assetIds, [{ property, value }]);
  return { note: "Change asset property", patchAssetsAttributes: patches };
}

export function changeProperties(
  { assets }: HydraulicModel,
  {
    assetIds,
    changes,
  }: {
    assetIds: AssetId[];
    changes: PropertyChange[];
  },
): ModelMoment {
  const patches = buildPatches(assets, assetIds, changes);
  return { note: "Change asset properties", patchAssetsAttributes: patches };
}

function buildPatches(
  assets: AssetsMap,
  assetIds: AssetId[],
  changes: readonly { property: ChangeableProperty; value: unknown }[],
): AssetPatch[] {
  const patches: AssetPatch[] = [];

  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    const properties: Record<string, unknown> = {};
    for (const { property, value } of changes) {
      if (property === "isActive") continue;
      if (!asset.hasProperty(property)) continue;
      properties[property] = value;
    }

    if (Object.keys(properties).length > 0) {
      patches.push({
        id: assetId,
        type: asset.type,
        properties,
      } as AssetPatch);
    }
  }

  return patches;
}
