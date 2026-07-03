import { useAtomValue } from "jotai";
import isEqual from "lodash/isEqual";
import { worktreeAtom } from "src/state/scenarios";
import { baseModelDerivedAtom } from "src/state/derived-branch-state";
import type { PropertyComparison } from "./use-asset-comparison";
import { type CustomerPointId } from "@epanet-js/hydraulic-model";
import {
  calculateAverageDemand,
  getCustomerPointDemands,
} from "@epanet-js/hydraulic-model";

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

  const getComparison = <T>(
    propertyName: string,
    currentValue: T,
  ): PropertyComparison<T> => {
    if (!isInScenario || customerPointId == null || isNew) {
      return { hasChanged: false };
    }

    const baseCustomerPoint = baseModel.customerPoints.get(customerPointId);
    if (!baseCustomerPoint) {
      return { hasChanged: false };
    }

    const baseValue = baseCustomerPoint.getProperty(propertyName) as T;
    const hasChanged = !isEqual(currentValue ?? null, baseValue ?? null);

    return { hasChanged, baseValue };
  };

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

  return { isInScenario, isNew, getComparison, getDemandComparison };
}
