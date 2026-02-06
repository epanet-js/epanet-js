import { useMemo } from "react";
import { useAtomValue } from "jotai";
import isEqual from "lodash/isEqual";
import { worktreeAtom } from "src/state/scenarios";
import { baseModelAtom } from "src/state/hydraulic-model";
import type { Asset, Pump } from "src/hydraulic-model";
import {
  calculateAverageDemand,
  type JunctionDemand,
} from "src/hydraulic-model/demands";
import { CurvePoint, ICurve } from "src/hydraulic-model/curves";

export type PropertyComparison<T = unknown> = {
  hasChanged: boolean;
  baseValue?: T;
};

export type PumpCurveComparison = PropertyComparison<
  CurvePoint[] | undefined
> & { curve?: Pick<ICurve, "id" | "label"> };

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
    const hasChanged = !isEqual(currentValue, baseValue);

    return { hasChanged, baseValue };
  };

  const getDirectDemandComparison = (
    currentDirectDemand: number,
  ): PropertyComparison<number> => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const baseDemands = (
      baseAsset.feature.properties as Record<string, unknown>
    ).demands as JunctionDemand[] | undefined;

    const baseDirectDemand = calculateAverageDemand(
      baseDemands || [],
      baseModel.demands.patterns,
    );

    const hasChanged = baseDirectDemand !== currentDirectDemand;

    return { hasChanged, baseValue: baseDirectDemand };
  };

  const getPumpCurveComparison = (
    currentCurve: CurvePoint[] | undefined,
  ): PumpCurveComparison => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }
    const baseCurve = (baseAsset as Pump).getCurve(baseModel.curves);
    const baseCurvePoints = baseCurve
      ? "id" in baseCurve
        ? baseCurve.points
        : baseCurve
      : undefined;

    const hasChanged = !isEqual(currentCurve, baseCurvePoints);

    return {
      hasChanged,
      baseValue: baseCurvePoints,
      curve: baseCurve && "id" in baseCurve ? baseCurve : undefined,
    };
  };

  return {
    isInScenario,
    getComparison,
    getDirectDemandComparison,
    getPumpCurveComparison,
    isNew,
  };
}
