import { useAtomValue } from "jotai";
import { AssetId, AssetsMap } from "src/hydraulics/assets";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { dataAtom, momentLogAtom } from "src/state/jotai";
import { buildOptimizedAssetsSource } from "./map-engine";
import { focusAtom } from "jotai-optics";
import { useCallback, useMemo, useRef } from "react";
import { Moment } from "src/lib/persistence/moment";
import { Feature } from "geojson";
import { useAtomCallback } from "jotai/utils";
import { MomentLog } from "src/lib/persistence/moment-log";

const assetsAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("hydraulicModel").prop("assets"),
);

const filterImportMoments = (momentLog: MomentLog) => {
  const result = [];
  for (const { moment } of momentLog) {
    if (moment.note && moment.note.startsWith("Import")) {
      result.push(moment);
    }
  }
  return result;
};

const filterEditionMoments = (momentLog: MomentLog) => {
  const result = [];
  for (const { moment } of momentLog) {
    if (!moment.note || !moment.note.startsWith("Import")) {
      result.push(moment);
    }
  }
  return result;
};

const areSameImportMoments = (a: Moment[], b: Moment[]): boolean => {
  return a.length === b.length;
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

const filterAssets = (assets: AssetsMap, assetIds: Set<AssetId>): AssetsMap => {
  const resultAssets = new AssetsMap();
  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) continue;

    resultAssets.set(asset.id, asset);
  }
  return resultAssets;
};

export const useMapState = (idMap: IDMap) => {
  const momentLog = useAtomValue(momentLogAtom);
  const importState = useRef<{
    moments: Moment[];
    features: Feature[];
  }>({ moments: [], features: [] });

  const getCurrentAssets = useAtomCallback(
    useCallback((get) => get(assetsAtom), []),
  );
  const momentLogPointer = momentLog.getPointer();

  const importedFeatures = useMemo(() => {
    const importMoments = filterImportMoments(momentLog);
    if (areSameImportMoments(importState.current.moments, importMoments)) {
      return importState.current.features;
    }

    const importedAssetIds = getAssetIdsInMoments(importMoments);
    const importedAssets = filterAssets(getCurrentAssets(), importedAssetIds);

    const noSymbolization = null;
    const noPreviewProperty = "";
    const features = buildOptimizedAssetsSource(
      importedAssets,
      idMap,
      noSymbolization,
      noPreviewProperty,
    );
    importState.current = {
      moments: importMoments,
      features: features as Feature[],
    };
    return features;
  }, [momentLog, momentLogPointer, getCurrentAssets, idMap]);

  const { editionAssetIds, editionFeatures } = useMemo(() => {
    const editionMoments = filterEditionMoments(momentLog);
    const editionAssetIds = getAssetIdsInMoments(editionMoments);
    const editedAssets = filterAssets(getCurrentAssets(), editionAssetIds);

    const noSymbolization = null;
    const noPreviewProperty = "";
    const features = buildOptimizedAssetsSource(
      editedAssets,
      idMap,
      noSymbolization,
      noPreviewProperty,
    );
    return { editionAssetIds, editionFeatures: features };
  }, [momentLog, momentLogPointer, getCurrentAssets, idMap]);

  const hiddenImportedFeatures = useMemo(() => {
    return Array.from(editionAssetIds).map((uuid) =>
      UIDMap.getIntID(idMap, uuid),
    );
  }, [editionAssetIds, idMap]);

  return {
    importedFeatures,
    editionFeatures,
    hiddenImportedFeatures,
  };
};
