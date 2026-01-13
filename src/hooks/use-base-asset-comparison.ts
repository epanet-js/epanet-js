import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { scenariosAtom } from "src/state/scenarios";
import { Asset } from "src/hydraulic-model";

export type PropertyComparison = {
  hasChanged: boolean;
  baseValue?: unknown;
};

export function useAssetComparison(asset: Asset | undefined) {
  const scenariosState = useAtomValue(scenariosAtom);
  const isInScenario = scenariosState.activeScenarioId !== null;

  const baseAsset = useMemo(() => {
    if (!isInScenario || !asset || !scenariosState.baseModelSnapshot) {
      return undefined;
    }
    return scenariosState.baseModelSnapshot.moment.putAssets?.find(
      (a) => a.id === asset.id,
    );
  }, [isInScenario, asset?.id, scenariosState.baseModelSnapshot]);

  const getComparison = (
    propertyName: string,
    currentValue: unknown,
  ): PropertyComparison => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const baseValue = (
      baseAsset.feature.properties as Record<string, unknown>
    )[propertyName];
    const hasChanged = baseValue !== currentValue;

    return { hasChanged, baseValue };
  };

  return { isInScenario, getComparison };
}
