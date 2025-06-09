import type { HandlerContext } from "src/types";
import { Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { modeAtom } from "src/state/mode";
import { getMapCoord } from "src/map/map-event";
import { useSelection } from "src/selection";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";

import { getNode } from "src/hydraulic-model";
import { moveNode } from "src/hydraulic-model/model-operations";
import { useMoveState } from "./move-state";
import noop from "lodash/noop";
import {
  fetchElevationForPoint,
  prefetchElevationsTileDeprecated,
} from "src/map/elevations";
import { captureError } from "src/infra/error-tracking";
import { QueryProvider, getClickedFeature } from "src/map/fuzzy-click";
import { decodeId } from "src/lib/id";
import { UIDMap } from "src/lib/id_mapper";
import { Asset } from "src/hydraulic-model";

export function useNoneHandlers({
  throttledMovePointer,
  selection,
  idMap,
  rep,
  map,
  hydraulicModel,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const {
    clearSelection,
    isSelected,
    toggleSingleSelection,
    extendSelection,
    removeFromSelection,
    getSelectionIds,
  } = useSelection(selection);
  const { isShiftHeld } = useKeyboardState();
  const { startMove, updateMove, resetMove, isMoving } = useMoveState();
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();

  const skipMove = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
    throttledMovePointer(e.point);
  };

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

  const handlers: Handlers = {
    double: noop,
    down: async (e) => {
      if (selection.type !== "single") {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();
      const clickedAsset = getClickedAsset(e);
      if (!clickedAsset || clickedAsset.id !== assetId) {
        return;
      }

      e.preventDefault();
      const node = getNode(hydraulicModel.assets, assetId);
      if (!node) return;

      const { putAssets } = moveNode(hydraulicModel, {
        nodeId: node.id,
        newCoordinates: node.coordinates,
        newElevation: await fetchElevationForPoint(e.lngLat, {
          unit: node.getUnit("elevation"),
        }),
      });
      putAssets && startMove(putAssets);
      setCursor("move");
    },
    move: (e) => {
      e.preventDefault();
      if (selection.type !== "single" || !isMoving) {
        return skipMove(e);
      }
      prefetchElevationsTileDeprecated(e.lngLat).catch(captureError);

      const [assetId] = getSelectionIds();
      const asset = hydraulicModel.assets.get(assetId);
      if (!asset || asset.isLink) return;

      const newCoordinates = getMapCoord(e);
      const noElevation = 0;
      const { putAssets } = moveNode(hydraulicModel, {
        nodeId: asset.id,
        newCoordinates,
        newElevation: noElevation,
      });
      putAssets && updateMove(putAssets);
    },
    up: async (e) => {
      e.preventDefault();
      if (selection.type !== "single" || !isMoving) {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();
      const node = getNode(hydraulicModel.assets, assetId);
      if (!node) return skipMove(e);

      const newCoordinates = getMapCoord(e);
      const moment = moveNode(hydraulicModel, {
        nodeId: assetId,
        newCoordinates,
        newElevation: await fetchElevationForPoint(e.lngLat, {
          unit: node.getUnit("elevation"),
        }),
      });
      transact(moment);
      resetMove();
      clearSelection();
    },
    click: (e) => {
      const clickedAsset = getClickedAsset(e);
      e.preventDefault();

      if (!clickedAsset) {
        if (isShiftHeld()) return;

        clearSelection();
        resetMove();
        setMode({ mode: Mode.NONE });
        return;
      }

      if (isShiftHeld()) {
        if (isSelected(clickedAsset.id)) {
          removeFromSelection(clickedAsset.id);
        } else {
          extendSelection(clickedAsset.id);
        }
      } else {
        toggleSingleSelection(clickedAsset.id, clickedAsset.type);
      }
    },
    exit() {
      resetMove();
      clearSelection();
    },
  };

  return handlers;
}
