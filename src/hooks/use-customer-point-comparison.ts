import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { baseModelDerivedAtom } from "src/state/derived-branch-state";
import type { PropertyComparison } from "./use-asset-comparison";
import type { CustomerPointId } from "src/hydraulic-model/customer-points";
import {
  calculateAverageDemand,
  getCustomerPointDemands,
} from "src/hydraulic-model/demands";

export function useCustomerPointComparison(
  customerPointId: CustomerPointId | undefined,
) {
  const worktree = useAtomValue(worktreeAtom);
  const baseModel = useAtomValue(baseModelDerivedAtom);
  const isInScenario = worktree.activeBranchId !== worktree.mainId;

  const isNew =
    isInScenario &&
    customerPointId != null &&
    !baseModel.customerPoints.has(customerPointId);

  const getDemandComparison = (
    currentAverageDemand: number,
  ): PropertyComparison<number> => {
    if (!isInScenario || customerPointId == null || isNew)
      return { hasChanged: false };
    const baseDemands = getCustomerPointDemands(
      baseModel.demands,
      customerPointId,
    );
    const baseAverage = calculateAverageDemand(baseDemands, baseModel.patterns);
    return {
      hasChanged: baseAverage !== currentAverageDemand,
      baseValue: baseAverage,
    };
  };

  return { isInScenario, isNew, getDemandComparison };
}
