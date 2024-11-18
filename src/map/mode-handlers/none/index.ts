import * as utils from "src/lib/map_component_utils";
import type { HandlerContext } from "src/types";
import { Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { modeAtom } from "src/state/mode";
import { getMapCoord } from "src/map/map-event";
import { useSelection } from "src/selection";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import { NodeAsset, getNodeCoordinates, isLink } from "src/hydraulics/assets";
import { moveNode } from "src/hydraulics/model-operations";
import { useMoveState } from "./move-state";
import noop from "lodash/noop";
import {
  fetchElevationForPoint,
  getElevationAt,
  prefetchElevationsTile,
} from "src/map/queries";
import { isFeatureOn } from "src/infra/feature-flags";
import { captureError } from "src/infra/error-tracking";

export function useNoneHandlers({
  throttledMovePointer,
  selection,
  idMap,
  folderMap,
  rep,
  pmap,
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

  const getClickedFeature = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ) => {
    const fuzzyResult = utils.fuzzyClick(e, {
      idMap,
      featureMapDeprecated: hydraulicModel.assets,
      folderMap,
      pmap,
    });

    return fuzzyResult;
  };

  const handlers: Handlers = {
    double: noop,
    down: (e) => {
      if (selection.type !== "single") {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();
      const clickedFeature = getClickedFeature(e);
      if (!clickedFeature || clickedFeature.wrappedFeature.id !== assetId) {
        return;
      }

      e.preventDefault();
      const asset = hydraulicModel.assets.get(assetId);
      if (!asset || isLink(asset)) return;

      const { putAssets } = moveNode(hydraulicModel, {
        nodeId: asset.id,
        newCoordinates: getNodeCoordinates(asset as NodeAsset),
        newElevation: getElevationAt(pmap, e.lngLat),
      });
      putAssets && startMove(putAssets);
      setCursor("move");
    },
    move: (e) => {
      e.preventDefault();
      if (selection.type !== "single" || !isMoving) {
        return skipMove(e);
      }
      const [assetId] = getSelectionIds();
      if (isFeatureOn("FLAG_ELEVATIONS"))
        prefetchElevationsTile(e.lngLat).catch(captureError);

      const asset = hydraulicModel.assets.get(assetId);
      if (!asset || isLink(asset)) return;

      const newCoordinates = getMapCoord(e);
      const { putAssets } = moveNode(hydraulicModel, {
        nodeId: asset.id,
        newCoordinates,
        newElevation: getElevationAt(pmap, e.lngLat),
      });
      putAssets && updateMove(putAssets);
    },
    up: async (e) => {
      e.preventDefault();
      if (selection.type !== "single" || !isMoving) {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();

      const newCoordinates = getMapCoord(e);
      const moment = moveNode(hydraulicModel, {
        nodeId: assetId,
        newCoordinates,
        newElevation: isFeatureOn("FLAG_ELEVATIONS")
          ? await fetchElevationForPoint(e.lngLat)
          : 0,
      });
      transact(moment);
      resetMove();
      clearSelection();
    },
    click: (e) => {
      const clickedFeature = getClickedFeature(e);
      e.preventDefault();

      if (!clickedFeature) {
        if (isShiftHeld()) return;

        clearSelection();
        resetMove();
        setMode({ mode: Mode.NONE });
        return;
      }

      const { wrappedFeature, decodedId } = clickedFeature;

      if (decodedId.type !== "feature") return;

      const id = wrappedFeature.id;

      if (isShiftHeld()) {
        if (isSelected(id)) {
          removeFromSelection(id);
        } else {
          extendSelection(id);
        }
      } else {
        toggleSingleSelection(id);
      }
    },
    exit() {
      resetMove();
      clearSelection();
    },
  };

  return handlers;
}
