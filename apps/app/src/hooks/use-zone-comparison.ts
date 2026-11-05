import { useAtomValue } from "jotai";
import isEqual from "lodash/isEqual";
import type { ZoneId } from "@epanet-js/hydraulic-model";
import { worktreeAtom } from "src/state/scenarios";
import { baseModelDerivedAtom } from "src/state/derived-branch-state";
import type { PropertyComparison } from "./use-asset-comparison";

export function useZoneComparison(zoneId: ZoneId | undefined) {
  const worktree = useAtomValue(worktreeAtom);
  const baseModel = useAtomValue(baseModelDerivedAtom);
  const isInScenario = worktree.activeBranchId !== worktree.mainId;

  const isNew = isInScenario && zoneId != null && !baseModel.zones.has(zoneId);

  const getComparison = <T>(
    propertyName: string,
    currentValue: T,
  ): PropertyComparison<T> => {
    if (!isInScenario || zoneId == null || isNew) {
      return { hasChanged: false };
    }

    const baseZone = baseModel.zones.get(zoneId);
    if (!baseZone) {
      return { hasChanged: false };
    }

    const baseValue = baseZone.getProperty(propertyName) as T;
    const hasChanged = !isEqual(currentValue ?? null, baseValue ?? null);

    return { hasChanged, baseValue };
  };

  return { isInScenario, isNew, getComparison };
}
