import { atom, useAtomValue } from "jotai";
import { useCallback, useMemo, useRef } from "react";
import { Moment } from "src/lib/persistence/moment";
import {
  EphemeralEditingState,
  PreviewProperty,
  Sel,
  assetsAtom,
  ephemeralStateAtom,
  layerConfigAtom,
  memoryMetaAtom,
  momentLogAtom,
  selectionAtom,
} from "src/state/jotai";
import { MapEngine } from "./map-engine";
import { buildOptimizedAssetsSource } from "./data-source";
import { usePersistence } from "src/lib/persistence/context";
import { ISymbolization, LayerConfigMap, SYMBOLIZATION_NONE } from "src/types";
import loadAndAugmentStyle from "src/lib/load_and_augment_style";
import { AssetId, AssetsMap, filterAssets } from "src/hydraulics/assets-map";
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
import { isFeatureOn } from "src/infra/feature-flags";

const isImportMoment = (moment: Moment) => {
  return !!moment.note && moment.note.startsWith("Import");
};

const latestImportAtom = atom((get) => {
  const momentLog = get(momentLogAtom);
  return momentLog.searchLast(isImportMoment);
});

const latestChangeAtom = atom((get) => {
  return get(momentLogAtom).getPointer();
});

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

export const useMapStateUpdates = (map: MapEngine | null) => {
  const momentLog = useAtomValue(momentLogAtom);
  const latestImportPointer = useAtomValue(latestImportAtom);
  const latestChangePointer = useAtomValue(latestChangeAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const selection = useAtomValue(selectionAtom);

  const assets = useAtomValue(assetsAtom);
  const layerConfigs = useAtomValue(layerConfigAtom);
  const rep = usePersistence();
  const idMap = rep.idMap;
  const { symbolization, label } = useAtomValue(memoryMetaAtom);
  const stylesConfig: StylesConfig = useMemo(
    () => ({
      symbolization: symbolization || SYMBOLIZATION_NONE,
      previewProperty: label,
      layerConfigs,
    }),
    [label, layerConfigs, symbolization],
  );
  const importPointer = useRef<number | null>(null);
  const editionsPointer = useRef<number>(0);
  const lastEphemeralSync = useRef<EphemeralEditingState>({ type: "none" });
  const nextEphemeralSync = useRef<EphemeralEditingState>();
  const lastSelectionSync = useRef<Sel>();
  const lastStylesSync = useRef<StylesConfig>();
  const isUpdatingSources = useRef<boolean>(false);
  const lastHiddenFeatures = useRef<Set<RawId>>(new Set([]));

  nextEphemeralSync.current = ephemeralState;

  const doUpdates = useCallback(async () => {
    if (!map) return;

    const hasStyleRefresh = lastStylesSync.current !== stylesConfig;

    if (hasStyleRefresh) {
      lastStylesSync.current = stylesConfig;
      await updateLayerStyles(map, stylesConfig);
    }

    if (importPointer.current !== latestImportPointer || hasStyleRefresh) {
      importPointer.current = latestImportPointer;
      isUpdatingSources.current = true;

      await updateImportSource(
        map,
        momentLog,
        latestImportPointer,
        assets,
        idMap,
        stylesConfig,
      );

      isUpdatingSources.current = false;
    }

    if (latestChangePointer !== editionsPointer.current || hasStyleRefresh) {
      editionsPointer.current = latestChangePointer;
      isUpdatingSources.current = true;

      const editedAssetIds = await updateEditionsSource(
        map,
        momentLog,
        latestImportPointer,
        assets,
        idMap,
        stylesConfig,
      );
      const newHiddenFeatures = updateVisibilityFeatureState(
        map,
        lastHiddenFeatures.current,
        editedAssetIds,
        idMap,
      );

      lastHiddenFeatures.current = newHiddenFeatures;
      isUpdatingSources.current = false;
    }

    if (
      !!nextEphemeralSync.current &&
      lastEphemeralSync.current !== nextEphemeralSync.current &&
      !isUpdatingSources.current
    ) {
      updateEphemeralStateOvelay(map, nextEphemeralSync.current);
      if (isFeatureOn("FLAG_RESERVOIR")) {
        hideFeaturesInEphemeralState(
          map,
          lastEphemeralSync.current,
          nextEphemeralSync.current,
          lastHiddenFeatures.current,
          idMap,
        );
      }
      lastEphemeralSync.current = nextEphemeralSync.current;
    }

    if (lastSelectionSync.current !== selection && !isUpdatingSources.current) {
      updateSelectionFeatureState(map, selection);
      lastSelectionSync.current = selection;
    }
  }, [
    assets,
    idMap,
    latestImportPointer,
    latestChangePointer,
    stylesConfig,
    map,
    momentLog,
    selection,
  ]);

  doUpdates().catch((e) => captureError(e));

  return { isUpdatingSources: isUpdatingSources.current };
};

const updateLayerStyles = withInstrumentation(
  async (map: MapEngine, styles: StylesConfig) => {
    const style = await loadAndAugmentStyle(styles);
    await map.setStyle(style);
  },
  { name: "MAP_STATE:UPDATE_STYLES", maxDurationMs: 1000 },
);

const updateImportSource = withInstrumentation(
  async (
    map: MapEngine,
    momentLog: MomentLog,
    latestImportPointer: number | null,
    assets: AssetsMap,
    idMap: IDMap,
    styles: StylesConfig,
  ) => {
    const importMoments =
      latestImportPointer === null
        ? []
        : momentLog.fetchUpToAndIncluding(latestImportPointer);

    const importedAssetIds = getAssetIdsInMoments(importMoments);
    const importedAssets = filterAssets(assets, importedAssetIds);

    const features = buildOptimizedAssetsSource(
      importedAssets,
      idMap,
      styles.symbolization,
      styles.previewProperty,
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
    styles: StylesConfig,
  ): Promise<Set<AssetId>> => {
    const editionMoments =
      latestImportPointer === null
        ? momentLog.fetchAll()
        : momentLog.fetchAfter(latestImportPointer);

    const editionAssetIds = getAssetIdsInMoments(editionMoments);
    const editedAssets = filterAssets(assets, editionAssetIds);

    const features = buildOptimizedAssetsSource(
      editedAssets,
      idMap,
      styles.symbolization,
      styles.previewProperty,
    );
    await map.setSource("features", features);

    return editionAssetIds;
  },
  {
    name: "MAP_STATE:UPDATE_EDITIONS_SOURCE",
    maxDurationMs: 250,
  },
);

const updateVisibilityFeatureState = withInstrumentation(
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

const hideFeaturesInEphemeralState = withInstrumentation(
  (
    map: MapEngine,
    previousEphemeralState: EphemeralEditingState | undefined,
    currentEphemeralState: EphemeralEditingState,
    featuresHiddenFromImport: Set<RawId>,
    idMap: IDMap,
  ) => {
    const previousIds = getFeaturesToHideFrom(previousEphemeralState, idMap);
    const currentIds = getFeaturesToHideFrom(currentEphemeralState, idMap);

    for (const featureId of previousIds) {
      map.showFeature("features", featureId);
      if (featuresHiddenFromImport.has(featureId)) continue;

      map.showFeature("imported-features", featureId);
    }

    for (const featureId of currentIds) {
      map.hideFeature("features", featureId);
      if (featuresHiddenFromImport.has(featureId)) continue;

      map.hideFeature("imported-features", featureId);
    }
  },
  {
    name: "MAP_STATE:UPDATE_VISIBILITY_OF_EDITIONS",
    maxDurationMs: 100,
  },
);

const updateEphemeralStateOvelay = withInstrumentation(
  (map: MapEngine, ephemeralState: EphemeralEditingState) => {
    const layers = [
      ephemeralState.type === "drawPipe" && buildDrawPipeLayers(ephemeralState),
      ephemeralState.type === "moveAssets" &&
        buildMoveAssetsLayers(ephemeralState),

      ephemeralState.type === "lasso" &&
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
    map.setOverlay(layers);
  },
  { name: "MAP_STATE:UPDATE_OVERLAYS", maxDurationMs: 100 },
);

const updateSelectionFeatureState = withInstrumentation(
  (map: MapEngine, selection: Sel) => {
    map.setOnlySelection(selection);
  },
  { name: "MAP_STATE:UPDATE_SELECTION", maxDurationMs: 100 },
);

const getFeaturesToHideFrom = (
  ephemeralState: EphemeralEditingState | undefined,
  idMap: IDMap,
): RawId[] => {
  if (!ephemeralState) return [];

  switch (ephemeralState.type) {
    case "lasso":
      return [];
    case "moveAssets":
      return ephemeralState.targetAssets.map((a) =>
        UIDMap.getIntID(idMap, a.id),
      );
    case "drawPipe":
      return [];
    case "none":
      return [];
  }
};
