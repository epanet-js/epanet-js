import { decodeId, encodeVertex } from "src/lib/id";
import * as utils from "src/lib/map_component_utils";
import type { HandlerContext, IWrappedFeature } from "src/types";
import noop from "lodash/noop";
import * as ops from "src/lib/map_operations_deprecated";
import { Mode, cursorStyleAtom, ephemeralStateAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { USelection } from "src/selection";
import { modeAtom } from "src/state/mode";
import { CURSOR_DEFAULT, DECK_SYNTHETIC_ID } from "src/lib/constants";
import { getMapCoord } from "./utils";
import { useRef } from "react";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { useSelection } from "src/selection";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";

export function useNoneHandlers({
  throttledMovePointer,
  dragTargetRef,
  selection,
  featureMap,
  idMap,
  folderMap,
  rep,
  pmap,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const {
    setSelection,
    clearSelection,
    isSelected,
    toggleSingleSelection,
    extendSelection,
    removeFromSelection,
  } = useSelection(selection);
  const { isShiftHeld } = useKeyboardState();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransactDeprecated();
  const dragStartPoint = useRef<mapboxgl.LngLat | null>(null);

  const updateDraggingState = (features: IWrappedFeature[]) => {
    setEphemeralState({
      type: "drag",
      features,
    });
  };

  const skipMove = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
    throttledMovePointer(e.point);
  };

  const moveFeatures = (
    ids: IWrappedFeature["id"][],
    start: mapboxgl.LngLat,
    end: mapboxgl.LngLat,
  ) => {
    const dx = start.lng - end.lng;
    const dy = start.lat - end.lat;
    const features = ids.map((uuid) => {
      const feature = featureMap.get(uuid)!;
      return {
        ...feature,
        feature: ops.moveFeature(feature.feature, dx, dy),
      };
    });
    return features;
  };

  const movePoint = (
    featureId: IWrappedFeature["id"],
    vertexId: VertexId,
    position: Pos2,
  ) => {
    const wrappedFeature = featureMap.get(featureId)!;
    const { feature: newFeature } = ops.setCoordinates({
      feature: wrappedFeature.feature,
      position: position,
      vertexId: vertexId,
    });
    return { ...wrappedFeature, feature: newFeature };
  };

  const getClickedFeature = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ) => {
    const fuzzyResult = utils.fuzzyClick(e, {
      idMap,
      featureMap,
      folderMap,
      pmap,
    });

    return fuzzyResult;
  };

  const isMovingEnabled = false;

  const handlers: Handlers = {
    double: noop,
    down: (e) => {
      dragStartPoint.current = e.lngLat;

      const isRighClick =
        "button" in e.originalEvent && e.originalEvent.button === 2;
      if (isRighClick) {
        return;
      }
      if (!isMovingEnabled) return;

      const selectedIds = USelection.toIds(selection);
      const isMovingManyPoints =
        (e.originalEvent.altKey || isMovingEnabled) && selectedIds.length;
      if (isMovingManyPoints) {
        dragTargetRef.current = selectedIds.slice();
        e.preventDefault();
        return;
      }

      // Is this a potential drag or selection?
      // If there is a feature under the cursor, prevent this
      // from being a drag and set the current drag target.
      const feature = pmap.overlay.pickObject({
        ...e.point,
        layerIds: [DECK_SYNTHETIC_ID],
      });

      if (!feature?.object || selection.type !== "single") {
        const fuzzyResult = utils.fuzzyClick(e, {
          idMap,
          featureMap,
          folderMap,
          pmap,
        });

        if (fuzzyResult) {
          const { wrappedFeature, id } = fuzzyResult;
          if (
            selection.type === "single" &&
            selection.id !== wrappedFeature.id
          ) {
            dragTargetRef.current = id;
            setSelection(USelection.single(wrappedFeature.id));
          }
          e.preventDefault();
        }

        return;
      }
      e.preventDefault();

      const rawId = feature.object.id as RawId;
      const id = decodeId(rawId);
      const wrappedFeature = featureMap.get(selection.id);

      if (!wrappedFeature) {
        captureWarning("Unexpected missing wrapped feature");
        return;
      }

      // Splice a midpoint, if the drag target is a midpoint.
      if (id.type === "midpoint") {
        const spliced = ops.spliceNewVertex({
          feature: wrappedFeature.feature,
          id,
          position: getMapCoord(e),
        });
        transact({
          note: "Splice a midpoint",
          putFeatures: [
            {
              ...wrappedFeature,
              feature: spliced,
            },
          ],
        })
          .then(() => {
            dragTargetRef.current = encodeVertex(id.featureId, id.vertex + 1);
          })
          .catch((e) => captureError(e));

        return;
      }

      dragTargetRef.current = rawId;
      setCursor("pointer");
    },
    move: (e) => {
      if (!isMovingEnabled) return skipMove(e);

      if (dragTargetRef.current === null || selection.type !== "single") {
        skipMove(e);
        return;
      }

      if (dragStartPoint.current === null) {
        dragStartPoint.current = e.lngLat;
      }

      const dragTarget = dragTargetRef.current;

      const isDraggingManyPoints = Array.isArray(dragTarget);
      if (isDraggingManyPoints) {
        const updatedFeatures = moveFeatures(
          dragTarget,
          dragStartPoint.current,
          e.lngLat,
        );
        updateDraggingState(updatedFeatures);
        return;
      }

      const id = decodeId(dragTarget);
      if (id.type !== "vertex") {
        return skipMove(e);
      }

      updateDraggingState([movePoint(selection.id, id, getMapCoord(e))]);
    },
    up: (e) => {
      if (!isMovingEnabled) return;
      const dragTarget = dragTargetRef.current;

      const resetDrag = () => {
        dragTargetRef.current = null;
        dragStartPoint.current = null;
        setEphemeralState({ type: "none" });
        setCursor(CURSOR_DEFAULT);
      };

      if (
        !dragTarget ||
        selection.type !== "single" ||
        dragStartPoint.current === null
      ) {
        return resetDrag();
      }

      const isDraggingManyPoints = Array.isArray(dragTarget);
      if (isDraggingManyPoints) {
        const updatedFeatures = moveFeatures(
          dragTarget,
          dragStartPoint.current,
          e.lngLat,
        );
        transact({
          note: "Move features",
          putFeatures: updatedFeatures,
          quiet: true,
        });
        return resetDrag();
      }

      const id = decodeId(dragTarget);
      if (id.type !== "vertex") return resetDrag();

      return transact({
        note: "Move point",
        putFeatures: [movePoint(selection.id, id, getMapCoord(e))],
        quiet: true,
      })
        .then(() => {
          resetDrag();
        })
        .catch((e) => captureError(e));
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
      setEphemeralState({ type: "none" });
      clearSelection();
    },
  };

  return handlers;
}
