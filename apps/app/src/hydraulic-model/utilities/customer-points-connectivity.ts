import type { HydraulicModel } from "../hydraulic-model";

/**
 * For a set of asset ids (pipes and/or junctions), return the ids of all
 * customer points connected to any of them. Dedupes via a Set — a CP that is
 * indexed under both its pipe and its junction is returned once.
 */
export const collectConnectedCustomerPointIds = (
  assetIds: readonly number[],
  hydraulicModel: HydraulicModel,
): number[] => {
  const cpIds = new Set<number>();
  for (const id of assetIds) {
    for (const cp of hydraulicModel.customerPointsLookup.getCustomerPoints(
      id,
    )) {
      cpIds.add(cp.id);
    }
  }
  return Array.from(cpIds);
};
