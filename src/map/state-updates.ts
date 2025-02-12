import { atom, useAtomValue } from "jotai";
import { useCallback, useRef } from "react";
import { Layer as DeckLayer } from "@deck.gl/core";
import { Moment } from "src/lib/persistence/moment";
import {
  EphemeralEditingState,
  PreviewProperty,
  Sel,
  SimulationState,
  assetsAtom,
  ephemeralStateAtom,
  layerConfigAtom,
  memoryMetaAtom,
  momentLogAtom,
  selectionAtom,
  simulationAtom,
} from "src/state/jotai";
import { MapEngine } from "./map-engine";
import { buildOptimizedAssetsSource } from "./data-source";
import { usePersistence } from "src/lib/persistence/context";
import { ISymbolization, LayerConfigMap, SYMBOLIZATION_NONE } from "src/types";
import loadAndAugmentStyle from "src/lib/load_and_augment_style";
import { Asset, AssetId, AssetsMap, filterAssets } from "src/hydraulic-model";
import { MomentLog } from "src/lib/persistence/moment-log";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { buildLayers as buildDrawPipeLayers } from "./mode-handlers/draw-pipe/ephemeral-state";
import { buildLayers as buildMoveAssetsLayers } from "./mode-handlers/none/move-state";
import { PolygonLayer } from "@deck.gl/layers";
import {
  DECK_LASSO_ID,
  LASSO_DARK_YELLOW,
  LASSO_YELLOW,
} from "src/lib/constants";
import { makeRectangle } from "src/lib/pmap/merge_ephemeral_state";
import { captureError } from "src/infra/error-tracking";
import { withInstrumentation } from "src/infra/with-instrumentation";
import { AnalysisState, analysisAtom } from "src/state/analysis";
import { USelection } from "src/selection";

const isImportMoment = (moment: Moment) => {
  return !!moment.note && moment.note.startsWith("Import");
};

const getAssetIdsInMoments = (moments: Moment[]): Set<AssetId> => {
  const assetIds = new Set<AssetId>();
  moments.forEach((moment) => {
    moment.deleteFeatures.forEach((assetId) => {
      assetIds.add(assetId);
    });
    moment.putFeatures.forEach((asset) => assetIds.add(asset.id));
  });
  return assetIds;
};

type StylesConfig = {
  symbolization: ISymbolization;
  layerConfigs: LayerConfigMap;
  previewProperty: PreviewProperty;
};

type MapState = {
  momentLogId: string;
  lastImportPointer: number | null;
  lastChangePointer: number;
  stylesConfig: StylesConfig;
  selection: Sel;
  ephemeralState: EphemeralEditingState;
  analysis: AnalysisState;
  simulation: SimulationState;
  selectedAssetIds: Set<AssetId>;
  movedAssetIds: Set<AssetId>;
};

const nullMapState: MapState = {
  momentLogId: "",
  lastImportPointer: null,
  lastChangePointer: 0,
  stylesConfig: {
    symbolization: SYMBOLIZATION_NONE,
    previewProperty: null,
    layerConfigs: new Map(),
  },
  selection: { type: "none" },
  ephemeralState: { type: "none" },
  analysis: { nodes: { type: "none" }, links: { type: "none" } },
  simulation: { status: "idle" },
  selectedAssetIds: new Set(),
  movedAssetIds: new Set(),
} as const;

const stylesConfigAtom = atom<StylesConfig>((get) => {
  const layerConfigs = get(layerConfigAtom);
  const { symbolization, label } = get(memoryMetaAtom);

  return {
    symbolization: symbolization || SYMBOLIZATION_NONE,
    previewProperty: label,
    layerConfigs,
  };
});

const momentLogPointersAtom = atom((get) => {
  const momentLog = get(momentLogAtom);
  const lastImportPointer = momentLog.searchLast(isImportMoment);
  const lastChangePointer = momentLog.getPointer();
  return {
    momentLogId: momentLog.id,
    lastImportPointer,
    lastChangePointer,
  };
});

const mapStateAtom = atom<MapState>((get) => {
  const { momentLogId, lastImportPointer, lastChangePointer } = get(
    momentLogPointersAtom,
  );
  const stylesConfig = get(stylesConfigAtom);
  const selection = get(selectionAtom);
  const ephemeralState = get(ephemeralStateAtom);
  const analysis = get(analysisAtom);
  const simulation = get(simulationAtom);
  const selectedAssetIds = new Set(USelection.toIds(selection));

  const movedAssetIds = getMovedAssets(ephemeralState);

  return {
    momentLogId,
    lastImportPointer,
    lastChangePointer,
    stylesConfig,
    selection,
    ephemeralState,
    analysis,
    simulation,
    selectedAssetIds,
    movedAssetIds,
  };
});

const detectChanges = (
  state: MapState,
  prev: MapState,
): {
  hasNewImport: boolean;
  hasNewEditions: boolean;
  hasNewStyles: boolean;
  hasNewSelection: boolean;
  hasNewEphemeralState: boolean;
  hasNewSimulation: boolean;
  hasNewAnalysis: boolean;
} => {
  return {
    hasNewImport: state.momentLogId !== prev.momentLogId,
    hasNewEditions: state.lastChangePointer !== prev.lastChangePointer,
    hasNewStyles: state.stylesConfig !== prev.stylesConfig,
    hasNewSelection: state.selection !== prev.selection,
    hasNewEphemeralState: state.ephemeralState !== prev.ephemeralState,
    hasNewSimulation: state.simulation !== prev.simulation,
    hasNewAnalysis: state.analysis !== prev.analysis,
  };
};

export const useMapStateUpdates = (map: MapEngine | null) => {
  const momentLog = useAtomValue(momentLogAtom);
  const mapState = useAtomValue(mapStateAtom);

  const assets = useAtomValue(assetsAtom);
  const { idMap } = usePersistence();
  const lastHiddenFeatures = useRef<Set<RawId>>(new Set([]));
  const previousMapStateRef = useRef<MapState>(nullMapState);
  const ephemeralStateOverlays = useRef<DeckLayer[]>([]);

  const doUpdates = useCallback(async () => {
    if (!map) return;

    if (mapState === previousMapStateRef.current) return;

    const previousMapState = previousMapStateRef.current;
    previousMapStateRef.current = mapState;

    const changes = detectChanges(mapState, previousMapState);
    const {
      hasNewImport,
      hasNewStyles,
      hasNewEditions,
      hasNewSelection,
      hasNewEphemeralState,
      hasNewAnalysis,
      hasNewSimulation,
    } = changes;

    if (hasNewImport || hasNewStyles) {
      resetMapState(map);
      await updateLayerStyles(map, mapState.stylesConfig);
    }

    if (hasNewAnalysis || hasNewStyles) {
      toggleAnalysisLayers(map, mapState.analysis);
    }

    if (
      hasNewImport ||
      hasNewStyles ||
      hasNewAnalysis ||
      (hasNewSimulation && mapState.simulation.status !== "running")
    ) {
      await updateImportSource(
        map,
        momentLog,
        mapState.lastImportPointer,
        assets,
        idMap,
        mapState.analysis,
      );
    }

    if (
      hasNewEditions ||
      hasNewStyles ||
      hasNewAnalysis ||
      (hasNewSimulation && mapState.simulation.status !== "running")
    ) {
      const editedAssetIds = await updateEditionsSource(
        map,
        momentLog,
        mapState.lastImportPointer,
        assets,
        idMap,
        mapState.analysis,
      );
      const newHiddenFeatures = updateImportedSourceVisibility(
        map,
        lastHiddenFeatures.current,
        editedAssetIds,
        idMap,
      );

      lastHiddenFeatures.current = newHiddenFeatures;
    }

    if (hasNewEphemeralState) {
      ephemeralStateOverlays.current = buildEphemeralStateOvelay(
        map,
        mapState.ephemeralState,
      );
      updateEditionsVisibility(
        map,
        previousMapState.movedAssetIds,
        mapState.movedAssetIds,
        lastHiddenFeatures.current,
        idMap,
      );
    }

    if (hasNewSelection && !hasNewImport) {
      updateSelection(
        map,
        mapState.selection,
        previousMapState.selection,
        idMap,
      );
    }

    map.setOverlay(ephemeralStateOverlays.current);
  }, [mapState, assets, idMap, map, momentLog]);

  doUpdates().catch((e) => captureError(e));
};

const resetMapState = withInstrumentation(
  (map: MapEngine) => {
    map.removeSource("features");
    map.removeSource("imported-features");
  },
  { name: "MAP_STATE:RESET_SOURCES", maxDurationMs: 100 },
);

const updateLayerStyles = withInstrumentation(
  async (map: MapEngine, styles: StylesConfig) => {
    const style = await loadAndAugmentStyle(styles);
    await map.setStyle(style);
  },
  { name: "MAP_STATE:UPDATE_STYLES", maxDurationMs: 1000 },
);

const toggleAnalysisLayers = withInstrumentation(
  (map: MapEngine, analysis: AnalysisState) => {
    if (analysis.links.type === "none") {
      map.hideLayers(["imported-pipe-arrows", "pipe-arrows"]);
    } else {
      map.showLayers(["imported-pipe-arrows", "pipe-arrows"]);
    }
    if (analysis.nodes.type === "none") {
      map.hideLayers(["imported-junction-results", "junction-results"]);
    } else {
      map.showLayers(["imported-junction-results", "junction-results"]);
    }
  },
  { name: "MAP_STATE:TOGGLE_ANALYSIS_LAYERS", maxDurationMs: 100 },
);

const updateImportSource = withInstrumentation(
  async (
    map: MapEngine,
    momentLog: MomentLog,
    latestImportPointer: number | null,
    assets: AssetsMap,
    idMap: IDMap,
    analysisState: AnalysisState,
  ) => {
    const importMoment = momentLog.getSnapshot();
    if (!importMoment) {
      await map.setSource("imported-features", []);
      return;
    }

    const importedAssets = new AssetsMap();
    for (const asset of importMoment.putFeatures as Asset[]) {
      importedAssets.set(asset.id, asset);
    }

    const features = buildOptimizedAssetsSource(
      importedAssets,
      idMap,
      analysisState,
    );
    await map.setSource("imported-features", features);
  },
  {
    name: "MAP_STATE:UPDATE_IMPORT_SOURCE",
    maxDurationMs: 10000,
    maxCalls: 10,
    callsIntervalMs: 1000,
  },
);

const updateEditionsSource = withInstrumentation(
  async (
    map: MapEngine,
    momentLog: MomentLog,
    latestImportPointer: number | null,
    assets: AssetsMap,
    idMap: IDMap,
    analysisState: AnalysisState,
  ): Promise<Set<AssetId>> => {
    let editionMoments: Moment[];

    editionMoments = momentLog.fetchAllDeltas();

    const editionAssetIds = getAssetIdsInMoments(editionMoments);
    const editedAssets = filterAssets(assets, editionAssetIds);

    const features = buildOptimizedAssetsSource(
      editedAssets,
      idMap,
      analysisState,
    );
    await map.setSource("features", features);

    return editionAssetIds;
  },
  {
    name: "MAP_STATE:UPDATE_EDITIONS_SOURCE",
    maxDurationMs: 250,
  },
);

const updateImportedSourceVisibility = withInstrumentation(
  (
    map: MapEngine,
    lastHiddenFeatures: Set<RawId>,
    editedAssetIds: Set<AssetId>,
    idMap: IDMap,
  ): Set<RawId> => {
    const newHiddenFeatures = Array.from(editedAssetIds).map((uuid) =>
      UIDMap.getIntID(idMap, uuid),
    );
    const newShownFeatures = Array.from(lastHiddenFeatures).filter(
      (intId) => !editedAssetIds.has(UIDMap.getUUID(idMap, intId)),
    );
    map.showFeatures("imported-features", newShownFeatures);
    map.hideFeatures("imported-features", newHiddenFeatures);

    return new Set(newHiddenFeatures);
  },
  { name: "MAP_STATE:UPDATE_VISIBILTIES", maxDurationMs: 100 },
);

const updateEditionsVisibility = withInstrumentation(
  (
    map: MapEngine,
    previousMovedAssetIds: Set<AssetId>,
    movedAssetIds: Set<AssetId>,
    featuresHiddenFromImport: Set<RawId>,
    idMap: IDMap,
  ) => {
    for (const assetId of previousMovedAssetIds.values()) {
      const featureId = UIDMap.getIntID(idMap, assetId);
      map.showFeature("features", featureId);
      if (featuresHiddenFromImport.has(featureId)) continue;

      map.showFeature("imported-features", featureId);
    }

    for (const assetId of movedAssetIds.values()) {
      const featureId = UIDMap.getIntID(idMap, assetId);
      map.hideFeature("features", featureId);
      if (featuresHiddenFromImport.has(featureId)) continue;

      map.hideFeature("imported-features", featureId);
    }
  },
  {
    name: "MAP_STATE:UPDATE_EDITIONS_VISIBILITY",
    maxDurationMs: 100,
  },
);

const buildEphemeralStateOvelay = withInstrumentation(
  (map: MapEngine, ephemeralState: EphemeralEditingState): DeckLayer[] => {
    let ephemeralLayers: DeckLayer[] = [];

    if (ephemeralState.type === "drawPipe") {
      ephemeralLayers = buildDrawPipeLayers(ephemeralState) as DeckLayer[];
    }
    if (ephemeralState.type === "moveAssets") {
      ephemeralLayers = buildMoveAssetsLayers(ephemeralState);
    }
    if (ephemeralState.type === "lasso") {
      ephemeralLayers = [
        new PolygonLayer<number[]>({
          id: DECK_LASSO_ID,
          data: [makeRectangle(ephemeralState)],
          visible: ephemeralState.type === "lasso",
          pickable: false,
          stroked: true,
          filled: true,
          lineWidthUnits: "pixels",
          getPolygon: (d) => d,
          getFillColor: LASSO_YELLOW,
          getLineColor: LASSO_DARK_YELLOW,
          getLineWidth: 1,
        }),
      ];
    }
    return ephemeralLayers;
  },
  { name: "MAP_STATE:BUILD_EPHEMERAL_STATE_OVERLAY", maxDurationMs: 100 },
);

const updateSelection = withInstrumentation(
  (map: MapEngine, selection: Sel, previousSelection: Sel, idMap: IDMap) => {
    const prevSet = new Set(USelection.toIds(previousSelection));
    const newSet = new Set(USelection.toIds(selection));

    for (const assetId of newSet) {
      const featureId = UIDMap.getIntID(idMap, assetId);
      map.selectFeature("features", featureId);
      map.selectFeature("imported-features", featureId);
    }

    for (const assetId of prevSet) {
      if (newSet.has(assetId)) continue;
      const featureId = UIDMap.getIntID(idMap, assetId);

      map.unselectFeature("features", featureId);
      map.unselectFeature("imported-features", featureId);
    }
  },
  { name: "MAP_STATE:UPDATE_SELECTION", maxDurationMs: 100 },
);

const noMoved: Set<AssetId> = new Set();
const getMovedAssets = (
  ephemeralState: EphemeralEditingState,
): Set<AssetId> => {
  switch (ephemeralState.type) {
    case "lasso":
      return noMoved;
    case "moveAssets":
      return new Set(ephemeralState.oldAssets.map((asset) => asset.id));
    case "drawPipe":
      return noMoved;
    case "none":
      return noMoved;
  }
};
