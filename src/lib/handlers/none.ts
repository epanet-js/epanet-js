import { decodeId, encodeVertex } from "src/lib/id";
import * as utils from "src/lib/map_component_utils";
import type { HandlerContext, IWrappedFeature } from "src/types";
import noop from "lodash/noop";
import * as ops from "src/lib/map_operations";
import {
  Mode,
  selectionAtom,
  cursorStyleAtom,
  ephemeralStateAtom,
} from "src/state/jotai";
import { useSetAtom } from "jotai";
import { USelection } from "src/state";
import { modeAtom } from "src/state/mode";
import { CURSOR_DEFAULT, DECK_SYNTHETIC_ID } from "src/lib/constants";
import { getMapCoord } from "./utils";
import { useRef } from "react";
import { useSpaceHeld } from "src/hooks/use_held";
import { captureError, captureWarning } from "src/infra/error-tracking";

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
  const setSelection = useSetAtom(selectionAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const dragStartPoint = useRef<mapboxgl.LngLat | null>(null);
  const spaceHeld = useSpaceHeld();

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

  const handlers: Handlers = {
    double: noop,
    down: (e) => {
      dragStartPoint.current = e.lngLat;

      const isRighClick =
        "button" in e.originalEvent && e.originalEvent.button === 2;
      if (isRighClick) {
        return;
      }

      const selectedIds = USelection.toIds(selection);
      const isMovingManyPoints =
        (e.originalEvent.altKey || spaceHeld.current) && selectedIds.length;
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
      const updateDraggingState = (features: IWrappedFeature[]) => {
        setEphemeralState({
          type: "drag",
          features,
        });
      };

      if (dragTargetRef.current === null) {
        throttledMovePointer(e.point);
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

      if (selection.type === "single") {
        // Otherwise, we are moving one vertex.
        const id = decodeId(dragTarget);
        switch (id.type) {
          case "feature":
          case "midpoint": {
            break;
          }
          case "vertex": {
            // junctions are also considered vertex at this point!!
            const feature = featureMap.get(selection.id);
            if (!feature) return;

            const nextCoord = getMapCoord(e);
            const { feature: newFeature } = ops.setCoordinates({
              feature: feature.feature,
              position: nextCoord,
              vertexId: id,
            });

            updateDraggingState([
              {
                ...feature,
                feature: newFeature,
              },
            ]);

            break;
          }
        }
      }
    },
    up: (e) => {
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

      const wrappedFeature = featureMap.get(selection.id);
      if (!wrappedFeature) return resetDrag();

      const nextCoord = getMapCoord(e);
      const { feature: newFeature } = ops.setCoordinates({
        feature: wrappedFeature.feature,
        position: nextCoord,
        vertexId: id,
      });

      return transact({
        note: "Move point",
        putFeatures: [
          {
            ...wrappedFeature,
            feature: newFeature,
          },
        ],
        quiet: true,
      })
        .then(() => {
          resetDrag();
        })
        .catch((e) => captureError(e));
    },
    click: (e) => {
      // Get the fuzzy feature. This is a mapboxgl feature
      // with only an id.
      const fuzzyResult = utils.fuzzyClick(e, {
        idMap,
        featureMap,
        folderMap,
        pmap,
      });

      // If there's a selection right now and someone clicked on
      // bare map, clear the selection.
      if (!fuzzyResult) {
        setSelection(USelection.none());
        setMode({ mode: Mode.NONE });
        return;
      }

      const { wrappedFeature, decodedId } = fuzzyResult;

      const feature = wrappedFeature.feature;
      // StringId
      const id = wrappedFeature.id;

      switch (decodedId.type) {
        case "feature": {
          setSelection(USelection.single(id));
          break;
        }
        case "vertex": {
          setSelection({
            type: "single",
            parts: [decodedId],
            id,
          });
          break;
        }
        case "midpoint": {
          // Midpoint dragging is handled by the mousemove handler.
          break;
        }
      }

      if (feature.geometry === null) {
        return;
      }

      // If someone clicked on the first or last vertex of
      // a line, start drawing that line again.
      if (
        !(
          decodedId.type === "vertex" &&
          feature.geometry.type === "LineString" &&
          USelection.isVertexSelected(selection, id, decodedId)
        )
      ) {
        return;
      }
    },
    enter() {
      setEphemeralState({ type: "none" });
      setSelection(USelection.none());
    },
  };

  return handlers;
}
