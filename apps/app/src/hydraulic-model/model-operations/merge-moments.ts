import type { ModelMoment } from "../model-operation";

const append = <T>(target: T[], source: T[] | undefined): void => {
  if (!source) return;
  for (const item of source) target.push(item);
};

export const mergeMoments = (
  moments: ModelMoment[],
  note: string,
): ModelMoment | null => {
  if (moments.length === 0) return null;
  if (moments.length === 1) return moments[0];

  const merged: ModelMoment = { note };

  const deleteAssets: NonNullable<ModelMoment["deleteAssets"]> = [];
  const putAssets: NonNullable<ModelMoment["putAssets"]> = [];
  const patchAssetsAttributes: NonNullable<
    ModelMoment["patchAssetsAttributes"]
  > = [];
  const patchCustomerPointsAttributes: NonNullable<
    ModelMoment["patchCustomerPointsAttributes"]
  > = [];
  const putCustomerPoints: NonNullable<ModelMoment["putCustomerPoints"]> = [];
  const deleteCustomerPoints: NonNullable<ModelMoment["deleteCustomerPoints"]> =
    [];

  for (const m of moments) {
    append(deleteAssets, m.deleteAssets);
    append(putAssets, m.putAssets);
    append(patchAssetsAttributes, m.patchAssetsAttributes);
    append(patchCustomerPointsAttributes, m.patchCustomerPointsAttributes);
    append(putCustomerPoints, m.putCustomerPoints);
    append(deleteCustomerPoints, m.deleteCustomerPoints);
    if (m.putDemands) merged.putDemands = m.putDemands;
    if (m.putControls) merged.putControls = m.putControls;
    if (m.putRawControls) merged.putRawControls = m.putRawControls;
    if (m.putCurves) merged.putCurves = m.putCurves;
    if (m.putPatterns) merged.putPatterns = m.putPatterns;
  }

  if (deleteAssets.length) merged.deleteAssets = deleteAssets;
  if (putAssets.length) merged.putAssets = putAssets;
  if (patchAssetsAttributes.length) {
    merged.patchAssetsAttributes = patchAssetsAttributes;
  }
  if (patchCustomerPointsAttributes.length) {
    merged.patchCustomerPointsAttributes = patchCustomerPointsAttributes;
  }
  if (putCustomerPoints.length) merged.putCustomerPoints = putCustomerPoints;
  if (deleteCustomerPoints.length) {
    merged.deleteCustomerPoints = deleteCustomerPoints;
  }

  // Fix to be able to restore CPs allocations when deleting them together with assets
  if (merged.putCustomerPoints?.length && merged.deleteCustomerPoints?.length) {
    const deletedIds = new Set(merged.deleteCustomerPoints);
    merged.putCustomerPoints = merged.putCustomerPoints.filter(
      (cp) => !deletedIds.has(cp.id),
    );
    if (merged.putCustomerPoints.length === 0) {
      delete merged.putCustomerPoints;
    }
  }

  return merged;
};
