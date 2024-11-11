import { atom } from "jotai";
import { AssetId, AssetsMap } from "src/hydraulics/assets";
import { IDMap } from "src/lib/id_mapper";
import { dataAtom, momentLogAtom } from "src/state/jotai";
import { buildOptimizedAssetsSource } from "./map-engine";
import { focusAtom } from "jotai-optics";

const assetsAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("hydraulicModel").prop("assets"),
);

export const editionsSourceAtom = (idMap: IDMap) =>
  atom((get) => {
    const momentLog = get(momentLogAtom);
    const assets = get(assetsAtom);

    const assetIds = new Set<AssetId>();
    momentLog.undo.forEach((moment) => {
      moment.deleteFeatures.forEach((assetId) => {
        assetIds.add(assetId);
      });
      moment.putFeatures.forEach((asset) => assetIds.add(asset.id));
    });
    const editionAssets = new AssetsMap();
    assetIds.forEach((assetId) => {
      const asset = assets.get(assetId);
      if (!asset) return;

      editionAssets.set(asset.id, asset);
    });

    const noSymbolization = null;
    const noPreviewProperty = "";
    const source = buildOptimizedAssetsSource(
      editionAssets,
      idMap,
      noSymbolization,
      noPreviewProperty,
    );
    return source;
  });
