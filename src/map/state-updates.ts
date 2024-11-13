import { atom, useAtomValue } from "jotai";
import { useCallback, useMemo, useRef } from "react";
import { Moment } from "src/lib/persistence/moment";
import {
  EphemeralEditingState,
  PreviewProperty,
  Sel,
  dataAtom,
  ephemeralStateAtom,
  layerConfigAtom,
  momentLogAtom,
  selectionAtom,
} from "src/state/jotai";
import { MapEngine, buildOptimizedAssetsSource } from "./map-engine";
import { isFeatureOn } from "src/infra/feature-flags";
import { focusAtom } from "jotai-optics";
import { usePersistence } from "src/lib/persistence/context";
import { ISymbolization, LayerConfigMap, SYMBOLIZATION_NONE } from "src/types";
import {
  FEATURES_SOURCE_NAME,
  IMPORTED_FEATURES_SOURCE_NAME,
} from "src/lib/load_and_augment_style";
import { AssetId, AssetsMap } from "src/hydraulics/assets";
import { MomentLog } from "src/lib/persistence/moment-log";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { monitorFrequency } from "src/infra/monitor-frequency";
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

const assetsAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("hydraulicModel").prop("assets"),
);

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

const filterAssets = (assets: AssetsMap, assetIds: Set<AssetId>): AssetsMap => {
  const resultAssets = new AssetsMap();
  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) continue;

    resultAssets.set(asset.id, asset);
  }
  return resultAssets;
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
  const [meta] = rep.useMetadata();
  const { label, symbolization } = meta;
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
  const lastEphemeralSync = useRef<EphemeralEditingState>();
  const lastSelectionSync = useRef<Sel>();
  const isUpdatingSources = useRef<boolean>(false);
  const lastHiddenFeatures = useRef<RawId[]>([]);

  const doUpdates = useCallback(async () => {
    if (!isFeatureOn("FLAG_SPLIT_SOURCES")) return;
    if (!map) return;

    if (importPointer.current !== latestImportPointer) {
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

    if (latestChangePointer !== editionsPointer.current) {
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
      lastEphemeralSync.current !== ephemeralState &&
      !isUpdatingSources.current
    ) {
      updateEphemeralStateOvelay(map, ephemeralState);
      lastEphemeralSync.current = ephemeralState;
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
    ephemeralState,
    selection,
  ]);

  doUpdates().catch((e) => captureError(e));

  return { isUpdatingSources: isUpdatingSources.current };
};

const updateImportSource = async (
  map: MapEngine,
  momentLog: MomentLog,
  latestImportPointer: number | null,
  assets: AssetsMap,
  idMap: IDMap,
  styles: StylesConfig,
) => {
  monitorFrequency("SET_MAP_IMPORT_SOURCE", {
    limit: 10,
    intervalMs: 1000,
  });
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
  await map.setOnlyStyle(styles);
  await map.setSource(IMPORTED_FEATURES_SOURCE_NAME, features);
};

const updateEditionsSource = async (
  map: MapEngine,
  momentLog: MomentLog,
  latestImportPointer: number | null,
  assets: AssetsMap,
  idMap: IDMap,
  styles: StylesConfig,
): Promise<Set<AssetId>> => {
  monitorFrequency("SET_MAP_EDITIONS_SOURCE", {
    limit: 10,
    intervalMs: 1000,
  });
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
  await map.setOnlyStyle(styles);
  await map.setSource(FEATURES_SOURCE_NAME, features);

  return editionAssetIds;
};

const updateVisibilityFeatureState = (
  map: MapEngine,
  lastHiddenFeatures: RawId[],
  editedAssetIds: Set<AssetId>,
  idMap: IDMap,
): RawId[] => {
  const newHiddenFeatures = Array.from(editedAssetIds).map((uuid) =>
    UIDMap.getIntID(idMap, uuid),
  );
  const newShownFeatures = lastHiddenFeatures.filter(
    (intId) => !editedAssetIds.has(UIDMap.getUUID(idMap, intId)),
  );
  map.showFeatures(IMPORTED_FEATURES_SOURCE_NAME, newShownFeatures);
  map.hideFeatures(IMPORTED_FEATURES_SOURCE_NAME, newHiddenFeatures);

  return newHiddenFeatures;
};

const updateEphemeralStateOvelay = (
  map: MapEngine,
  ephemeralState: EphemeralEditingState,
) => {
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
};

const updateSelectionFeatureState = (map: MapEngine, selection: Sel) => {
  map.setOnlySelection(selection);
};
