import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Map as MapboxMap, LngLatBoundsLike } from "mapbox-gl";
import { assetsAtom } from "src/state/jotai";
import { getExtent, isBBoxEmpty } from "src/lib/geometry";
import { useUserTracking } from "src/infra/user-tracking";

export function useFitToExtent() {
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get, _set, map: MapboxMap) => {
        const assets = get(assetsAtom);

        if (assets.size === 0) return;

        const features = [...assets.values()].map((asset) => asset.feature);
        const extent = getExtent(features).extract();

        if (!extent) return;

        userTracking.capture({ name: "fitMapToNetworkExtent.clicked" });

        map.fitBounds(extent as LngLatBoundsLike, {
          padding: 100,
          animate: true,
          maxZoom: isBBoxEmpty(extent) ? 18 : Infinity,
        });
      },
      [userTracking],
    ),
  );
}
