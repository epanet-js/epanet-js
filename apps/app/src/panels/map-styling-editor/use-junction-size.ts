import { useCallback, useContext, useEffect, useMemo } from "react";
import { useAtom } from "jotai";
import debounce from "lodash/debounce";
import { MapContext } from "src/map";
import { nodeSizeAtom } from "src/state/map-symbology";
import type { NodeSizeConfig } from "src/map/symbology/symbology-types";
import {
  junctionCircleRadius,
  junctionLayerMinZoom,
  JUNCTION_MAX_ZOOM,
} from "./node-size";

// Every junction layer built from junctionCircleSizes(): the main/delta feature
// layers plus the ephemeral (draft), highlight, and selection overlays. We drive
// their circle-radius imperatively so changing node size never triggers a full
// mapbox style rebuild, and so all junction representations stay in sync.
const JUNCTION_SIZE_LAYERS: string[] = [
  "main-features-junctions",
  "delta-features-junctions",
  "ephemeral-junction-highlight",
  "highlights-marker",
  "selected-junctions",
];

// Layers whose minzoom tracks the user's min visible zoom (the "real" junction
// display + selection). The ephemeral/draft and hover-highlight layers keep
// their own lower minzoom so editing/hover feedback stays visible when zoomed
// further out than the display threshold.
const JUNCTION_VISIBILITY_LAYERS: string[] = [
  "main-features-junctions",
  "delta-features-junctions",
  "selected-junctions",
];

// Coalesce rapid slider drags into one paint update per frame-ish window.
const APPLY_DEBOUNCE_MS = 80;

/**
 * Owns the node-size config and applies it to the map imperatively, debounced.
 * Returns `{ config, onChange }` for a controlled `NodeSizePopover`: `config`
 * updates synchronously so the UI tracks the thumb, while the map paint is
 * debounced for performance.
 */
export function useJunctionSize() {
  const map = useContext(MapContext);
  const [config, setConfig] = useAtom(nodeSizeAtom);

  const applyToMap = useMemo(
    () =>
      debounce((next: NodeSizeConfig) => {
        if (!map || !map.map.isStyleLoaded()) return;
        const radius = junctionCircleRadius(next);
        for (const layerId of JUNCTION_SIZE_LAYERS) {
          if (!map.map.getLayer(layerId)) continue;
          map.setLayerPaintRule(layerId, "circle-radius", radius);
        }
        const minzoom = junctionLayerMinZoom(next);
        for (const layerId of JUNCTION_VISIBILITY_LAYERS) {
          if (!map.map.getLayer(layerId)) continue;
          map.setLayerZoomRange(layerId, minzoom, JUNCTION_MAX_ZOOM);
        }
      }, APPLY_DEBOUNCE_MS),
    [map],
  );

  useEffect(() => () => applyToMap.cancel(), [applyToMap]);

  const onChange = useCallback(
    (next: NodeSizeConfig) => {
      setConfig(next);
      applyToMap(next);
    },
    [applyToMap, setConfig],
  );

  return { config, onChange };
}
