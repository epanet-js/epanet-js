import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { baseModelAtom } from "src/state/hydraulic-model";
import type { Asset, DemandPatterns } from "src/hydraulic-model";
import type { CurveId, ICurve } from "src/hydraulic-model/curves";
import {
  calculateAverageDemand,
  type JunctionDemand,
} from "src/hydraulic-model/demands";

export type PropertyComparison = {
  hasChanged: boolean;
  baseValue?: unknown;
};

export function useAssetComparison(asset: Asset | undefined) {
  const worktree = useAtomValue(worktreeAtom);
  const baseModel = useAtomValue(baseModelAtom);
  const isInScenario = worktree.activeSnapshotId !== worktree.mainId;

  const baseAsset = useMemo(() => {
    if (!isInScenario || !asset) {
      return undefined;
    }
    return baseModel.assets.get(asset.id);
  }, [isInScenario, asset, baseModel]);

  const isNew = isInScenario && asset !== undefined && baseAsset === undefined;

  const getBaseCurve = (curveId: CurveId | undefined): ICurve | undefined => {
    if (!curveId || !isInScenario) return undefined;
    return baseModel.curves.get(curveId);
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

  const getDirectDemandComparison = (
    currentDirectDemand: number,
    patterns: DemandPatterns,
  ): PropertyComparison => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const baseDemands = (
      baseAsset.feature.properties as Record<string, unknown>
    ).demands as JunctionDemand[] | undefined;

    const baseDirectDemand = calculateAverageDemand(
      baseDemands || [],
      patterns,
    );

    const hasChanged = baseDirectDemand !== currentDirectDemand;

    return { hasChanged, baseValue: baseDirectDemand };

    if (!baseDemands) {
      return { hasChanged: false };
    }
  };

  const getConstantDemandComparison = (
    currentConstantDemand: number,
  ): PropertyComparison => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const baseDemands = (
      baseAsset.feature.properties as Record<string, unknown>
    ).demands as JunctionDemand[] | undefined;

    if (!baseDemands) {
      return { hasChanged: false };
    }

    const baseConstantDemand = baseDemands
      .filter((d) => !d.patternId)
      .reduce((sum, d) => sum + d.baseDemand, 0);

    const hasChanged = baseConstantDemand !== currentConstantDemand;

    return { hasChanged, baseValue: baseConstantDemand };
  };

  return {
    isInScenario,
    getComparison,
    getBaseCurve,
    getConstantDemandComparison,
    getDirectDemandComparison,
    isNew,
  };
}
