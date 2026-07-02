import { Asset } from "@epanet-js/hydraulic-model";
import {
  customAttributeIdFromKey,
  customPropertyKey,
  isCustomProperty,
} from "@epanet-js/custom-attributes";
import { customAttributesDataSchema } from "@epanet-js/ejsdb";

export const serializeAssetCustomAttributes = (asset: Asset): string | null => {
  const data: Record<string, string | number> = {};
  let hasValues = false;
  for (const key of asset.listProperties()) {
    if (!isCustomProperty(key)) continue;
    const value = asset.getProperty(key);
    if (value === null || value === undefined) continue;
    data[customAttributeIdFromKey(key)] = value as string | number;
    hasValues = true;
  }
  return hasValues ? JSON.stringify(data) : null;
};

export const applyAssetCustomAttributes = (
  asset: Asset,
  json: string | null,
): void => {
  if (json === null) return;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new Error("Custom attributes: data is not valid JSON", {
      cause: error,
    });
  }
  const result = customAttributesDataSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Custom attributes: data does not match schema — ${result.error.message}`,
    );
  }
  for (const [id, value] of Object.entries(result.data)) {
    if (value === null) continue;
    asset.setProperty(customPropertyKey(id), value);
  }
};
