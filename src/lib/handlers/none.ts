import * as utils from "src/lib/map_component_utils";
import type { HandlerContext } from "src/types";
import { Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { modeAtom } from "src/state/mode";
import { getMapCoord } from "./utils";
import { useSelection } from "src/selection";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import {
  Asset,
  NodeAsset,
  getNodeCoordinates,
  isLink,
} from "src/hydraulics/assets";
import { moveNode } from "src/hydraulics/model-operations";
import { isFeatureOn } from "src/infra/feature-flags";
import { useMoveState } from "./default/move-state";
import noop from "lodash/noop";

export function useNoneHandlers({
  throttledMovePointer,
  selection,
  featureMapDeprecated,
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
      featureMapDeprecated,
      folderMap,
      pmap,
    });

    return fuzzyResult;
  };

  const handlers: Handlers = {
    double: noop,
    down: (e) => {
      if (selection.type !== "single" || !isFeatureOn("FLAG_MOVE")) {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();
      const clickedFeature = getClickedFeature(e);
      if (!clickedFeature || clickedFeature.wrappedFeature.id !== assetId) {
        return;
      }

      e.preventDefault();
      const asset = hydraulicModel.assets.get(assetId);
      if (!asset || isLink(asset as Asset)) return;

      const { putAssets } = moveNode(hydraulicModel, {
        nodeId: asset.id,
        newCoordinates: getNodeCoordinates(asset as NodeAsset),
      });
      putAssets && startMove(putAssets);
      setCursor("move");
    },
    move: (e) => {
      e.preventDefault();
      if (
        selection.type !== "single" ||
        !isMoving ||
        !isFeatureOn("FLAG_MOVE")
      ) {
        return skipMove(e);
      }
      const [assetId] = getSelectionIds();

      const asset = hydraulicModel.assets.get(assetId) as Asset;
      if (!asset || isLink(asset)) return;

      const newCoordinates = getMapCoord(e);
      const { putAssets } = moveNode(hydraulicModel, {
        nodeId: asset.id,
        newCoordinates,
      });
      putAssets && updateMove(putAssets);
    },
    up: (e) => {
      e.preventDefault();
      if (
        selection.type !== "single" ||
        !isMoving ||
        !isFeatureOn("FLAG_MOVE")
      ) {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();

      const newCoordinates = getMapCoord(e);
      const moment = moveNode(hydraulicModel, {
        nodeId: assetId,
        newCoordinates,
      });
      transact(moment).then(() => {
        resetMove();
      });
    },
    click: (e) => {
      const clickedFeature = getClickedFeature(e);
      e.preventDefault();

      if (!clickedFeature) {
        if (isShiftHeld()) return;

        clearSelection();
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
