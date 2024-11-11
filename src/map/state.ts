import { useAtomValue } from "jotai";
import { AssetId, AssetsMap } from "src/hydraulics/assets";
import { IDMap } from "src/lib/id_mapper";
import { dataAtom, momentLogAtom } from "src/state/jotai";
import { buildOptimizedAssetsSource } from "./map-engine";
import { focusAtom } from "jotai-optics";
import { useCallback, useMemo, useRef } from "react";
import { Moment, MomentLog } from "src/lib/persistence/moment";
import { Feature } from "geojson";
import { useAtomCallback } from "jotai/utils";

const assetsAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("hydraulicModel").prop("assets"),
);

const filterImportMoments = (momentLog: MomentLog) => {
  return momentLog.undo.filter(
    (moment) => moment.note && moment.note.startsWith("Import"),
  );
};

const filterEditionMoments = (momentLog: MomentLog) => {
  return momentLog.undo.filter(
    (moment) => !moment.note || !moment.note.startsWith("Import"),
  );
};

const areSameImportMoments = (a: Moment[], b: Moment[]): boolean => {
  return a.length === b.length;
};

const getAssetsFromMoments = (
  moments: Moment[],
  assets: AssetsMap,
): AssetsMap => {
  const assetIds = new Set<AssetId>();
  moments.forEach((moment) => {
    moment.deleteFeatures.forEach((assetId) => {
      assetIds.add(assetId);
    });
    moment.putFeatures.forEach((asset) => assetIds.add(asset.id));
  });

  const resultAssets = new AssetsMap();
  assetIds.forEach((assetId) => {
    const asset = assets.get(assetId);
    if (!asset) return;

    resultAssets.set(asset.id, asset);
  });
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

  const importedFeatures = useMemo(() => {
    const importMoments = filterImportMoments(momentLog);
    if (areSameImportMoments(importState.current.moments, importMoments)) {
      return importState.current.features;
    }

    const importedAssets = getAssetsFromMoments(
      importMoments,
      getCurrentAssets(),
    );

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
  }, [momentLog]);

  const editionFeatures = useMemo(() => {
    const editionMoments = filterEditionMoments(momentLog);
    const editedAssets = getAssetsFromMoments(
      editionMoments,
      getCurrentAssets(),
    );
    const noSymbolization = null;
    const noPreviewProperty = "";
    const features = buildOptimizedAssetsSource(
      editedAssets,
      idMap,
      noSymbolization,
      noPreviewProperty,
    );
    return features;
  }, [momentLog]);

  return { importedFeatures, editionFeatures };
};
