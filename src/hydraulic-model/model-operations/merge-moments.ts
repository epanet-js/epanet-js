import type { ModelMoment } from "../model-operation";

export const mergeMoments = (
  moments: ModelMoment[],
  note: string,
): ModelMoment | null => {
  if (moments.length === 0) return null;
  if (moments.length === 1) return moments[0];

  const merged: ModelMoment = { note };

  for (const m of moments) {
    if (m.deleteAssets?.length) {
      merged.deleteAssets = [...(merged.deleteAssets ?? []), ...m.deleteAssets];
    }
    if (m.putAssets?.length) {
      merged.putAssets = [...(merged.putAssets ?? []), ...m.putAssets];
    }
    if (m.patchAssetsAttributes?.length) {
      merged.patchAssetsAttributes = [
        ...(merged.patchAssetsAttributes ?? []),
        ...m.patchAssetsAttributes,
      ];
    }
    if (m.putCustomerPoints?.length) {
      merged.putCustomerPoints = [
        ...(merged.putCustomerPoints ?? []),
        ...m.putCustomerPoints,
      ];
    }
    if (m.deleteCustomerPoints?.length) {
      merged.deleteCustomerPoints = [
        ...(merged.deleteCustomerPoints ?? []),
        ...m.deleteCustomerPoints,
      ];
    }
    if (m.putDemands) merged.putDemands = m.putDemands;
    if (m.putControls) merged.putControls = m.putControls;
    if (m.putCurves) merged.putCurves = m.putCurves;
    if (m.putPatterns) merged.putPatterns = m.putPatterns;
  }

  return merged;
};
