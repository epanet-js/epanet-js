import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { scenariosAtom } from "src/state/scenarios";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { Asset } from "src/hydraulic-model";
import type { CurveId, ICurve } from "src/hydraulic-model/curves";

export type PropertyComparison = {
  hasChanged: boolean;
  baseValue?: unknown;
};

export function useAssetComparison(asset: Asset | undefined) {
  const scenariosState = useAtomValue(scenariosAtom);
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const isInScenario =
    isScenariosOn && scenariosState.activeScenarioId !== null;

  const baseAsset = useMemo(() => {
    if (!isInScenario || !asset || !scenariosState.baseModelSnapshot) {
      return undefined;
    }
    return scenariosState.baseModelSnapshot.moment.putAssets?.find(
      (a) => a.id === asset.id,
    );
  }, [isInScenario, asset, scenariosState.baseModelSnapshot]);

  const isNew = isInScenario && asset !== undefined && baseAsset === undefined;

  const baseCurves = useMemo(() => {
    if (!isInScenario || !scenariosState.baseModelSnapshot) return undefined;
    return scenariosState.baseModelSnapshot.moment.putCurves;
  }, [isInScenario, scenariosState.baseModelSnapshot]);

  const getBaseCurve = (curveId: CurveId | undefined): ICurve | undefined => {
    if (!curveId || !baseCurves) return undefined;
    return baseCurves.find((c) => c.id === curveId);
  };

  const getComparison = (
    propertyName: string,
    currentValue: unknown,
  ): PropertyComparison => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const baseValue = (baseAsset.feature.properties as Record<string, unknown>)[
      propertyName
    ];
    const hasChanged = baseValue !== currentValue;

    return { hasChanged, baseValue };
  };

  return { isInScenario, getComparison, getBaseCurve, isNew };
}
