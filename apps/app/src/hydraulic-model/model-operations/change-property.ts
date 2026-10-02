import { AssetId, AssetPropertiesMap } from "@epanet-js/hydraulic-model";
import { isCustomProperty } from "@epanet-js/hydraulic-model";
import type {
  AssetPatch,
  ModelMoment,
  OperationCode,
} from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { AssetsMap } from "@epanet-js/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import { changeSet, setAsset, type Fields } from "../change-sets";

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

type ChangePropertyData<P extends ChangeableProperty> = {
  assetIds: AssetId[];
  property: P;
  value: ChangeablePropertyValue<P>;
};

type ChangePropertiesData = {
  assetIds: AssetId[];
  changes: PropertyChange[];
};

export function changeProperty<P extends ChangeableProperty>(
  model: HydraulicModel,
  { assetIds, property, value }: ChangePropertyData<P>,
): ChangeSet {
  const patches = buildPatches(model.assets, assetIds, [{ property, value }]);
  return patchesChangeSet(model, "changeProperty", patches);
}

export function changeProperties(
  model: HydraulicModel,
  { assetIds, changes }: ChangePropertiesData,
): ChangeSet {
  const patches = buildPatches(model.assets, assetIds, changes);
  return patchesChangeSet(model, "changeProperties", patches);
}

export function changePropertyDeprecated<P extends ChangeableProperty>(
  { assets }: HydraulicModel,
  { assetIds, property, value }: ChangePropertyData<P>,
): ModelMoment {
  const patches = buildPatches(assets, assetIds, [{ property, value }]);
  return { note: "changeProperty", patchAssetsAttributes: patches };
}

export function changePropertiesDeprecated(
  { assets }: HydraulicModel,
  { assetIds, changes }: ChangePropertiesData,
): ModelMoment {
  const patches = buildPatches(assets, assetIds, changes);
  return { note: "changeProperties", patchAssetsAttributes: patches };
}

function patchesChangeSet(
  model: HydraulicModel,
  code: OperationCode,
  patches: AssetPatch[],
): ChangeSet {
  return changeSet(
    model,
    code,
    patches.map((patch) => setAsset(patch.id, patch.properties as Fields)),
  );
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
      if (!isCustomProperty(property) && !asset.hasProperty(property)) continue;
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
