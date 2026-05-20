import { useEffect, useRef, useState } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";
import {
  selectedFeaturesDerivedAtom,
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import { AssetTimeSeries } from "./types";

const BATCH_SIZE = 4;
const PROGRESS_THROTTLE_MS = 40;

export function useCustomGraphData(onProgress: (progress: number) => void) {
  const { nodeIds, linkIds } = useAtomValue(categorizedAssetIdsAtom);
  const setNodeProperty = useSetAtom(nodePropertyAtom);
  const setLinkProperty = useSetAtom(linkPropertyAtom);
  const nodeProperty = useAtomValue(nodePropertyAtom);
  const linkProperty = useAtomValue(linkPropertyAtom);

  const simulation = useAtomValue(simulationDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
  const qualityType = epsResultsReader?.qualityType ?? null;

  const hasNodes = nodeIds.size > 0;
  const hasLinks = linkIds.size > 0;

  const [seriesData, setSeriesData] = useState<CustomGraphSeriesData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    onProgressRef.current(0);
    setSeriesData(null);

    if (!epsResultsReader) {
      setSeriesData(EMPTY_SERIES);
      setIsLoading(false);
      onProgressRef.current(100);
      return;
    }

    const totalCount = nodeIds.size + linkIds.size;
    if (totalCount === 0) {
      setSeriesData(EMPTY_SERIES);
      setIsLoading(false);
      onProgressRef.current(100);
      return;
    }

    let fetched = 0;
    let lastProgressTime = 0;

    const reportProgress = (value: number) => {
      const now = performance.now();
      if (value >= 100 || now - lastProgressTime >= PROGRESS_THROTTLE_MS) {
        lastProgressTime = now;
        onProgressRef.current(value);
      }
    };

    const yieldToUi = async () => await new Promise((r) => setTimeout(r, 0));

    const fetchSeries = async (
      ids: Set<number>,
      property: string,
    ): Promise<AssetTimeSeries[] | null> => {
      if (ids.size === 0) return [];
      const entries = Array.from(ids);
      const results = new Array<AssetTimeSeries>(ids.size);
      let resultCount = 0;

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        if (controller.signal.aborted) return null;

        const batch = entries.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (id) => {
            const asset = hydraulicModel.assets.get(id);
            if (!asset) return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ts = await epsResultsReader.getTimeSeries(
              id,
              asset.type as any,
              property as any,
            );
            if (!ts) return null;
            const label = asset.label ?? `${asset.type} ${id}`;
            return { assetId: id, label, timeSeries: ts };
          }),
        );

        for (const r of batchResults) {
          if (r) results[resultCount++] = r;
        }

        fetched += batch.length;
        reportProgress(Math.trunc((fetched / totalCount) * 100));

        await yieldToUi();
      }

      results.length = resultCount;
      return results;
    };

    const completeLoad = async () => {
      const nodeSeriesData = await fetchSeries(nodeIds, nodeProperty);
      if (!nodeSeriesData) return;
      const linkSeriesData = await fetchSeries(linkIds, linkProperty);
      if (!linkSeriesData) return;

      if (!controller.signal.aborted) {
        setSeriesData({ nodeSeriesData, linkSeriesData });
        reportProgress(100);
        setIsLoading(false);
      }
    };

    void completeLoad();
    return () => controller.abort();
  }, [
    nodeIds,
    linkIds,
    nodeProperty,
    linkProperty,
    epsResultsReader,
    hydraulicModel,
  ]);

  const { nodeSeriesData, linkSeriesData } = seriesData ?? EMPTY_SERIES;

  return {
    hasNodes,
    hasLinks,
    nodeSeriesData,
    linkSeriesData,
    isLoading,
    qualityType,
    nodeProperty,
    linkProperty,
    setNodeProperty,
    setLinkProperty,
  };
}

const categorizedAssetIdsAtom = atom<{
  nodeIds: Set<number>;
  linkIds: Set<number>;
}>((get) => {
  const selectedFeatures = get(selectedFeaturesDerivedAtom);
  const hydraulicModel = get(stagingModelDerivedAtom);
  const nodeIds = new Set<number>();
  const linkIds = new Set<number>();

  for (const feature of selectedFeatures) {
    const asset = hydraulicModel.assets.get(feature.id);
    if (!asset) continue;

    if (NODE_TYPES.has(asset.type)) {
      nodeIds.add(feature.id);
    } else if (LINK_TYPES.has(asset.type)) {
      linkIds.add(feature.id);
    }
  }

  return { nodeIds, linkIds };
});

const EMPTY_SERIES: CustomGraphSeriesData = {
  nodeSeriesData: [],
  linkSeriesData: [],
};

interface CustomGraphSeriesData {
  nodeSeriesData: AssetTimeSeries[];
  linkSeriesData: AssetTimeSeries[];
}

const NODE_TYPES: Set<AssetType> = new Set(["junction", "tank", "reservoir"]);
const LINK_TYPES: Set<AssetType> = new Set(["pipe", "pump", "valve"]);

const nodePropertyAtom = atom("pressure");
const linkPropertyAtom = atom("flow");
