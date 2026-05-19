import { useState, useEffect, useRef, useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  selectedFeaturesDerivedAtom,
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { captureError } from "src/infra/error-tracking";
import type { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import type { AssetType } from "src/hydraulic-model/asset-types/types";

export interface AssetTimeSeries {
  assetId: number;
  label: string;
  timeSeries: TimeSeries;
}

interface CategorizedAsset {
  id: number;
  label: string;
  assetType: AssetType;
}

const NODE_TYPES: Set<AssetType> = new Set(["junction", "tank", "reservoir"]);
const LINK_TYPES: Set<AssetType> = new Set(["pipe", "pump", "valve"]);

export function useCustomGraphData(nodeProperty: string, linkProperty: string) {
  const selectedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
  const qualityType = epsResultsReader?.qualityType ?? null;

  const { nodeAssets, linkAssets } = useMemo(() => {
    const nodes: CategorizedAsset[] = [];
    const links: CategorizedAsset[] = [];
    for (const wf of selectedFeatures) {
      const asset = hydraulicModel.assets.get(wf.id);
      if (!asset) continue;
      const assetType = asset.type as AssetType;
      const label = asset.label ?? `${assetType} ${wf.id}`;
      if (NODE_TYPES.has(assetType)) {
        nodes.push({ id: wf.id, label, assetType });
      } else if (LINK_TYPES.has(assetType)) {
        links.push({ id: wf.id, label, assetType });
      }
    }
    return { nodeAssets: nodes, linkAssets: links };
  }, [selectedFeatures, hydraulicModel]);

  const hasNodes = nodeAssets.length > 0;
  const hasLinks = linkAssets.length > 0;

  const [nodeSeriesData, setNodeSeriesData] = useState<AssetTimeSeries[]>([]);
  const [linkSeriesData, setLinkSeriesData] = useState<AssetTimeSeries[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!epsResultsReader) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    const fetchAll = async () => {
      try {
        const [nodeResults, linkResults] = await Promise.all([
          hasNodes
            ? Promise.all(
                nodeAssets.map(async (a) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const ts = await epsResultsReader.getTimeSeries(
                    a.id,
                    a.assetType as any,
                    nodeProperty as any,
                  );
                  return ts
                    ? { assetId: a.id, label: a.label, timeSeries: ts }
                    : null;
                }),
              )
            : Promise.resolve([]),
          hasLinks
            ? Promise.all(
                linkAssets.map(async (a) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const ts = await epsResultsReader.getTimeSeries(
                    a.id,
                    a.assetType as any,
                    linkProperty as any,
                  );
                  return ts
                    ? { assetId: a.id, label: a.label, timeSeries: ts }
                    : null;
                }),
              )
            : Promise.resolve([]),
        ]);

        if (controller.signal.aborted) return;

        setNodeSeriesData(
          (nodeResults as (AssetTimeSeries | null)[]).filter(
            (r): r is AssetTimeSeries => r !== null,
          ),
        );
        setLinkSeriesData(
          (linkResults as (AssetTimeSeries | null)[]).filter(
            (r): r is AssetTimeSeries => r !== null,
          ),
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        captureError(err as Error);
        setNodeSeriesData([]);
        setLinkSeriesData([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchAll();

    return () => controller.abort();
  }, [
    epsResultsReader,
    nodeAssets,
    linkAssets,
    nodeProperty,
    linkProperty,
    hasNodes,
    hasLinks,
  ]);

  return {
    nodeAssets,
    linkAssets,
    hasNodes,
    hasLinks,
    nodeSeriesData,
    linkSeriesData,
    isLoading,
    qualityType,
  };
}
