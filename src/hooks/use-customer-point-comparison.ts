import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { baseModelAtom } from "src/state/hydraulic-model";
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
  const baseModel = useAtomValue(baseModelAtom);
  const isInScenario = worktree.activeSnapshotId !== worktree.mainId;

  const getDemandComparison = (
    currentAverageDemand: number,
  ): PropertyComparison<number> => {
    if (!isInScenario || customerPointId == null) return { hasChanged: false };
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

  return { isInScenario, getDemandComparison };
}
