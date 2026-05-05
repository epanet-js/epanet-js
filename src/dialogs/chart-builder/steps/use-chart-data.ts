import { useEffect, useRef, useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { getDecimals } from "src/lib/project-settings";
import {
  classifyAssetTypes,
  getAvailableProperties,
  isNodeType,
} from "../property-config";
import type { AssetType } from "src/hydraulic-model/asset-types";
import type { QuickGraphAssetType } from "src/state/quick-graph";
import type { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { captureError } from "src/infra/error-tracking";

export interface AssetSeries {
  assetId: number;
  label: string;
  type: AssetType;
  timeSeries: TimeSeries | null;
}

export interface ChartData {
  isLoading: boolean;
  hasSimulation: boolean;
  assetSeries: AssetSeries[];
  timestepCount: number;
  intervalSeconds: number;
  nodeSeries: AssetSeries[];
  linkSeries: AssetSeries[];
  allNodeValues: number[];
  allLinkValues: number[];
  nodeDecimals: number;
  linkDecimals: number;
  nodeAxisLabel: string;
  linkAxisLabel: string;
  isMixed: boolean;
}

export function percentile(sorted: number[], pct: number): number {
  const idx = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computePercentileSeries(
  allSeries: Float32Array[],
  timestepCount: number,
): {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
} {
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];

  for (let t = 0; t < timestepCount; t++) {
    const vals = allSeries.map((s) => s[t]).sort((a, b) => a - b);
    p10.push(percentile(vals, 10));
    p25.push(percentile(vals, 25));
    p50.push(percentile(vals, 50));
    p75.push(percentile(vals, 75));
    p90.push(percentile(vals, 90));
  }
  return { p10, p25, p50, p75, p90 };
}

export function buildTimeLabels(
  count: number,
  intervalSeconds: number,
): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const total = i * intervalSeconds;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    labels.push(`${h}:${m.toString().padStart(2, "0")}`);
  }
  return labels;
}

export function useChartData(
  selectedAssetIds: number[],
  nodeProperty: string | null,
  linkProperty: string | null,
): ChartData {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const simulation = useAtomValue(simulationDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units, formatting } = useAtomValue(projectSettingsAtom);

  const [assetSeries, setAssetSeries] = useState<AssetSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const epsResultsReader = useMemo(() => {
    if ("epsResultsReader" in simulation) return simulation.epsResultsReader;
    return null;
  }, [simulation]);

  const hasSimulation = epsResultsReader !== null;
  const qualityType = epsResultsReader?.qualityType ?? null;

  const assetTypes = useMemo(
    () =>
      selectedAssetIds.flatMap((id) => {
        const asset = hydraulicModel.assets.get(id);
        return asset ? [asset.type as AssetType] : [];
      }),
    [selectedAssetIds, hydraulicModel.assets],
  );

  const classification = useMemo(
    () => classifyAssetTypes(assetTypes),
    [assetTypes],
  );

  const effectiveNodeProp = useMemo(() => {
    if (!classification.hasNodes) return null;
    const opts = getAvailableProperties(
      classification.nodeTypes as QuickGraphAssetType[],
      qualityType,
    );
    return nodeProperty ?? opts[0]?.value ?? null;
  }, [classification, nodeProperty, qualityType]);

  const effectiveLinkProp = useMemo(() => {
    if (!classification.hasLinks) return null;
    const opts = getAvailableProperties(
      classification.linkTypes as QuickGraphAssetType[],
      qualityType,
    );
    return linkProperty ?? opts[0]?.value ?? null;
  }, [classification, linkProperty, qualityType]);

  useEffect(() => {
    if (!epsResultsReader) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const fetch = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          selectedAssetIds.map(async (id) => {
            const asset = hydraulicModel.assets.get(id);
            if (!asset) return null;
            const prop = isNodeType(asset.type)
              ? effectiveNodeProp
              : effectiveLinkProp;
            if (!prop) return null;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
            const ts = (await (epsResultsReader as any).getTimeSeries(
              id,
              asset.type,
              prop,
            )) as TimeSeries | null;
            return {
              assetId: id,
              label: asset.label,
              type: asset.type,
              timeSeries: ts,
            };
          }),
        );
        if (signal.aborted) return;
        setAssetSeries(results.filter(Boolean) as AssetSeries[]);
      } catch (err) {
        if (signal.aborted) return;
        captureError(err as Error);
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    };

    void fetch();
    return () => abortRef.current?.abort();
  }, [
    selectedAssetIds,
    effectiveNodeProp,
    effectiveLinkProp,
    epsResultsReader,
    hydraulicModel.assets,
  ]);

  const nodeDecimals = useMemo(() => {
    const opts = getAvailableProperties(
      classification.nodeTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveNodeProp);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return getDecimals(formatting, prop?.quantityKey as any) ?? 2;
  }, [classification.nodeTypes, effectiveNodeProp, qualityType, formatting]);

  const linkDecimals = useMemo(() => {
    const opts = getAvailableProperties(
      classification.linkTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveLinkProp);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return getDecimals(formatting, prop?.quantityKey as any) ?? 2;
  }, [classification.linkTypes, effectiveLinkProp, qualityType, formatting]);

  const nodeAxisLabel = useMemo(() => {
    const opts = getAvailableProperties(
      classification.nodeTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveNodeProp);
    if (!prop) return "";
    const unit = units[prop.quantityKey as keyof typeof units];
    const label = translate(prop.labelKey);
    return unit ? `${label} (${translateUnit(unit)})` : label;
  }, [
    classification.nodeTypes,
    effectiveNodeProp,
    qualityType,
    units,
    translate,
    translateUnit,
  ]);

  const linkAxisLabel = useMemo(() => {
    const opts = getAvailableProperties(
      classification.linkTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveLinkProp);
    if (!prop) return "";
    const unit = units[prop.quantityKey as keyof typeof units];
    const label = translate(prop.labelKey);
    return unit ? `${label} (${translateUnit(unit)})` : label;
  }, [
    classification.linkTypes,
    effectiveLinkProp,
    qualityType,
    units,
    translate,
    translateUnit,
  ]);

  const isMixed = classification.hasNodes && classification.hasLinks;
  const nodeSeries = assetSeries.filter((s) => isNodeType(s.type));
  const linkSeries = assetSeries.filter((s) => !isNodeType(s.type));
  const allNodeValues = nodeSeries.flatMap((s) =>
    s.timeSeries ? Array.from(s.timeSeries.values) : [],
  );
  const allLinkValues = linkSeries.flatMap((s) =>
    s.timeSeries ? Array.from(s.timeSeries.values) : [],
  );
  const timestepCount = assetSeries[0]?.timeSeries?.intervalsCount ?? 0;
  const intervalSeconds = assetSeries[0]?.timeSeries?.intervalSeconds ?? 3600;

  return {
    isLoading,
    hasSimulation,
    assetSeries,
    timestepCount,
    intervalSeconds,
    nodeSeries,
    linkSeries,
    allNodeValues,
    allLinkValues,
    nodeDecimals,
    linkDecimals,
    nodeAxisLabel,
    linkAxisLabel,
    isMixed,
  };
}
