import { atom, useAtomValue, useSetAtom } from "jotai";
import { unwrap } from "jotai/utils";
import {
  selectedFeaturesDerivedAtom,
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import type { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import type { AssetType } from "src/hydraulic-model/asset-types/types";

export interface AssetTimeSeries {
  assetId: number;
  label: string;
  timeSeries: TimeSeries;
}

interface CustomGraphSeriesData {
  nodeSeriesData: AssetTimeSeries[];
  linkSeriesData: AssetTimeSeries[];
}

const NODE_TYPES: Set<AssetType> = new Set(["junction", "tank", "reservoir"]);
const LINK_TYPES: Set<AssetType> = new Set(["pipe", "pump", "valve"]);

const nodePropertyAtom = atom("pressure");
const linkPropertyAtom = atom("flow");

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

const customGraphSeriesAtom = atom(
  async (get): Promise<CustomGraphSeriesData> => {
    const { nodeIds, linkIds } = get(categorizedAssetIdsAtom);
    const hydraulicModel = get(stagingModelDerivedAtom);
    const simulation = get(simulationDerivedAtom);
    const nodeProperty = get(nodePropertyAtom);
    const linkProperty = get(linkPropertyAtom);

    const epsResultsReader =
      "epsResultsReader" in simulation ? simulation.epsResultsReader : null;

    if (!epsResultsReader) {
      return { nodeSeriesData: [], linkSeriesData: [] };
    }

    const fetchSeries = async (
      ids: Set<number>,
      property: string,
    ): Promise<AssetTimeSeries[]> => {
      if (ids.size === 0) return [];
      const results = await Promise.all(
        Array.from(ids).map(async (id) => {
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
      return results.filter((r): r is AssetTimeSeries => r !== null);
    };

    const [nodeSeriesData, linkSeriesData] = await Promise.all([
      fetchSeries(nodeIds, nodeProperty),
      fetchSeries(linkIds, linkProperty),
    ]);

    return { nodeSeriesData, linkSeriesData };
  },
);

const EMPTY_SERIES: CustomGraphSeriesData = {
  nodeSeriesData: [],
  linkSeriesData: [],
};

const unwrappedCustomGraphSeriesAtom = unwrap(
  customGraphSeriesAtom,
  () => undefined,
);

export function useCustomGraphData() {
  const { nodeIds, linkIds } = useAtomValue(categorizedAssetIdsAtom);
  const setNodeProperty = useSetAtom(nodePropertyAtom);
  const setLinkProperty = useSetAtom(linkPropertyAtom);
  const nodeProperty = useAtomValue(nodePropertyAtom);
  const linkProperty = useAtomValue(linkPropertyAtom);
  const seriesData = useAtomValue(unwrappedCustomGraphSeriesAtom);

  const simulation = useAtomValue(simulationDerivedAtom);
  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
  const qualityType = epsResultsReader?.qualityType ?? null;

  const hasNodes = nodeIds.size > 0;
  const hasLinks = linkIds.size > 0;

  const isLoading = seriesData === undefined;
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
