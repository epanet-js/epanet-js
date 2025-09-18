import type { HandlerContext } from "src/types";
import { Mode, ephemeralStateAtom, modeAtom } from "src/state/jotai";
import { useSetAtom, useAtom } from "jotai";
import throttle from "lodash/throttle";
import { useSelection } from "src/selection";
import { QueryProvider, getClickedFeature } from "src/map/fuzzy-click";
import { decodeId } from "src/lib/id";
import { UIDMap } from "src/lib/id-mapper";
import { Asset } from "src/hydraulic-model";

export function useEditVerticesHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { selection, idMap, map, hydraulicModel } = handlerContext;
  const setMode = useSetAtom(modeAtom);
  const { clearSelection } = useSelection(selection);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);

  const getClickedAsset = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): Asset | null => {
    const rawId = getClickedFeature(map as QueryProvider, e.point);
    if (rawId === null) return null;

    const decodedId = decodeId(rawId);
    const uuid = UIDMap.getUUID(idMap, decodedId.featureId);

    const asset = hydraulicModel.assets.get(uuid);
    if (!asset) return null;

    return asset;
  };

  const exitEditVerticesMode = () => {
    clearSelection();
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  const move = throttle(
    (_e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {},
    16,
  );

  const click = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
    if (ephemeralState.type !== "editVertices") {
      return;
    }

    const clickedAsset = getClickedAsset(e);
    const currentLinkId = ephemeralState.linkId;

    if (!clickedAsset || clickedAsset.id !== currentLinkId) {
      exitEditVerticesMode();
    }
  };

  const handlers: Handlers = {
    click,
    double: () => {},
    move,
    down: () => {},
    up: () => {},
    exit: exitEditVerticesMode,
  };

  return handlers;
}
