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

const assetsAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("hydraulicModel").prop("assets"),
);

const isImportMoment = (moment: Moment) => {
  return !!moment.note && moment.note.startsWith("Import");
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
  const lastMomentPointer = momentLog.getPointer();

  const importPointer = useMemo(() => {
    return momentLog.searchLast(isImportMoment);
  }, [momentLog, lastMomentPointer]);

  const importedFeatures = useMemo(() => {
    if (importPointer === null) {
      const noFeatures: Feature[] = [];
      importState.current = {
        moments: [],
        features: noFeatures,
      };
      return noFeatures;
    }

    const importMoments = momentLog.fetchUpToAndIncluding(importPointer);
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
  }, [momentLog, importPointer, getCurrentAssets, idMap]);

  const { editionAssetIds, editionFeatures } = useMemo(() => {
    const editionMoments =
      importPointer === null
        ? momentLog.fetchAll()
        : momentLog.fetchAfter(importPointer);

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
  }, [momentLog, lastMomentPointer, importPointer, getCurrentAssets, idMap]);

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
