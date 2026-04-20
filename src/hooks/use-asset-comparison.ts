import { useMemo } from "react";
import { useAtomValue } from "jotai";
import isEqual from "lodash/isEqual";
import { worktreeAtom } from "src/state/scenarios";
import { baseModelDerivedAtom } from "src/state/derived-branch-state";
import type { Asset, Patterns, Pump } from "src/hydraulic-model";
import type { Pattern, PatternId } from "src/hydraulic-model/patterns";
import {
  calculateAverageDemand,
  getCustomerPointDemands,
  getJunctionDemands,
} from "src/hydraulic-model/demands";
import { getActiveCustomerPoints } from "src/hydraulic-model/customer-points";
import {
  CurveId,
  CurvePoint,
  Curves,
  ICurve,
} from "src/hydraulic-model/curves";

export type PropertyComparison<T = unknown> = {
  hasChanged: boolean;
  baseValue?: T;
};

export type PumpCurveComparison = PropertyComparison<
  CurvePoint[] | undefined
> & { curve?: Pick<ICurve, "id" | "label"> };

export function useAssetComparison(asset: Asset | undefined) {
  const worktree = useAtomValue(worktreeAtom);
  const baseModel = useAtomValue(baseModelDerivedAtom);
  const isInScenario = worktree.activeBranchId !== worktree.mainId;

  const baseAsset = useMemo(() => {
    if (!isInScenario || !asset) {
      return undefined;
    }
    return baseModel.assets.get(asset.id);
  }, [isInScenario, asset, baseModel]);

  const isNew = isInScenario && asset !== undefined && baseAsset === undefined;

  const getComparison = <T>(
    propertyName: string,
    currentValue: T,
  ): PropertyComparison<T> => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const baseValue = baseAsset.getProperty(propertyName) as T;
    const hasChanged = !isEqual(currentValue, baseValue);

    return { hasChanged, baseValue };
  };

  const getDirectDemandComparison = (
    currentDirectDemand: number,
  ): PropertyComparison<number> => {
    if (!isInScenario || !baseAsset || !asset) {
      return { hasChanged: false };
    }

    const baseDemands = getJunctionDemands(baseModel.demands, asset.id);

    const baseDirectDemand = calculateAverageDemand(
      baseDemands,
      baseModel.patterns,
    );

    const hasChanged = baseDirectDemand !== currentDirectDemand;

    return { hasChanged, baseValue: baseDirectDemand };
  };

  const getPatternComparison = (
    propertyName: string,
    currentPatternId: PatternId | undefined,
    currentPatterns: Patterns,
  ): PropertyComparison<Pattern> => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const basePatternId = baseAsset.getProperty(propertyName) as
      | PatternId
      | undefined;

    const basePattern = basePatternId
      ? baseModel.patterns.get(basePatternId)
      : undefined;

    if (basePatternId !== currentPatternId) {
      return { hasChanged: true, baseValue: basePattern };
    }

    if (currentPatternId != null) {
      const currentPattern = currentPatterns.get(currentPatternId);
      if (
        basePattern &&
        currentPattern &&
        !isEqual(basePattern.multipliers, currentPattern.multipliers)
      ) {
        return { hasChanged: true, baseValue: basePattern };
      }
    }

    return { hasChanged: false };
  };

  const getCurveComparison = (
    propertyName: string,
    currentCurveId: CurveId | undefined,
    currentCurves: Curves,
  ): PropertyComparison<ICurve> => {
    if (!isInScenario || !baseAsset) {
      return { hasChanged: false };
    }

    const baseCurveId = baseAsset.getProperty(propertyName) as
      | CurveId
      | undefined;

    const baseCurve = baseCurveId
      ? baseModel.curves.get(baseCurveId)
      : undefined;

    if (baseCurveId !== currentCurveId) {
      return { hasChanged: true, baseValue: baseCurve };
    }

    if (currentCurveId != null) {
      const currentCurve = currentCurves.get(currentCurveId);
      if (
        baseCurve &&
        currentCurve &&
        !isEqual(baseCurve.points, currentCurve.points)
      ) {
        return { hasChanged: true, baseValue: baseCurve };
      }
    }

    return { hasChanged: false };
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

  const getCustomerDemandComparison = (
    currentTotalDemand: number,
  ): PropertyComparison<number> => {
    if (!isInScenario || !baseAsset || !asset) {
      return { hasChanged: false };
    }

    const baseCustomerPoints = getActiveCustomerPoints(
      baseModel.customerPointsLookup,
      baseModel.assets,
      asset.id,
    );

    const baseTotalDemand = baseCustomerPoints.reduce(
      (sum, cp) =>
        sum +
        calculateAverageDemand(
          getCustomerPointDemands(baseModel.demands, cp.id),
          baseModel.patterns,
        ),
      0,
    );

    return {
      hasChanged: baseTotalDemand !== currentTotalDemand,
      baseValue: baseTotalDemand,
    };
  };

  const getCustomerCountComparison = (
    currentCount: number,
  ): PropertyComparison<number> => {
    if (!isInScenario || !baseAsset || !asset) {
      return { hasChanged: false };
    }

    const baseCustomerPoints = getActiveCustomerPoints(
      baseModel.customerPointsLookup,
      baseModel.assets,
      asset.id,
    );

    const baseCount = baseCustomerPoints.length;

    return {
      hasChanged: baseCount !== currentCount,
      baseValue: baseCount,
    };
  };

  return {
    isInScenario,
    getComparison,
    getPatternComparison,
    getDirectDemandComparison,
    getCustomerDemandComparison,
    getCustomerCountComparison,
    getCurveComparison,
    getPumpCurveComparison,
    isNew,
  };
}
