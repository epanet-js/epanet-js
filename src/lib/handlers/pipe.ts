import { USelection } from "src/state";
import type {
  Feature,
  HandlerContext,
  IFeature,
  IWrappedFeature,
  LineString,
  Position,
} from "src/types";
import {
  selectionAtom,
  modeAtom,
  Mode,
  cursorStyleAtom,
  ephemeralStateAtom,
} from "src/state/jotai";
import replaceCoordinates from "src/lib/replace_coordinates";
import { useSetAtom } from "jotai";
import { usePopMoment } from "src/lib/persistence/shared";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "./utils";
import { useRef } from "react";
import { captureError } from "src/infra/error-tracking";
import { newFeatureId } from "../id";

export function usePipeHandlers({
  rep,
  featureMap,
  folderMap,
  selection,
  mode,
  dragTargetRef,
}: HandlerContext): Handlers {
  const multi = mode.modeOptions?.multi;
  const setSelection = useSetAtom(selectionAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const popMoment = usePopMoment();
  const usingTouchEvents = useRef<boolean>(false);
  const drawingStart = useRef<Pos2 | null>(null);

  const setDrawingState = (features: IWrappedFeature[]) => {
    setEphemeralState({
      type: "drag",
      features,
    });
  };

  const resetDrawingState = () => {
    setEphemeralState({ type: "none" });
  };

  const createExtensionFeature = (start: Pos2, end: Pos2) => {
    return {
      id: newFeatureId(),
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [start, end],
        },
      } as Feature,
      folderId: null,
      at: "any",
    };
  };

  const extendLineString = (
    wrappedFeature: IWrappedFeature,
    position: Pos2,
  ) => {
    const feature = wrappedFeature.feature as IFeature<LineString>;
    return {
      ...wrappedFeature,
      feature: replaceCoordinates(
        feature,
        mode.modeOptions?.reverse
          ? [position as Position].concat(feature.geometry.coordinates)
          : feature.geometry.coordinates.concat([position]),
      ),
    };
  };

  const selectFeature = (feature: IWrappedFeature) => {
    setSelection(USelection.single(feature.id));
  };

  const handlers: Handlers = {
    click: (e) => {
      const clickPosition = getMapCoord(e);

      const isStarting =
        selection.type === "none" || selection.type === "folder";
      const isAddingVertex = selection.type === "single";

      if (isStarting) {
        const extensionFeature = createExtensionFeature(
          clickPosition,
          clickPosition,
        );

        drawingStart.current = clickPosition;
        selectFeature(extensionFeature);
        setDrawingState([extensionFeature]);
        return;
      }

      if (isAddingVertex && !!drawingStart.current) {
        const clickPosition = getMapCoord(e);
        let wrappedFeature = featureMap.get(selection.id);

        if (!wrappedFeature) {
          wrappedFeature = createExtensionFeature(
            drawingStart.current,
            clickPosition,
          );
          selectFeature(wrappedFeature);
        }

        const updatedLineString = extendLineString(
          wrappedFeature,
          clickPosition,
        );

        transact({
          note: "Added pipe vertex",
          putFeatures: [updatedLineString],
        }).catch((e) => captureError(e));

        drawingStart.current = clickPosition;
      }
    },
    move: (e) => {
      if (selection.type !== "single") return;

      const isApplePencil = e.type === "mousemove" && usingTouchEvents.current;
      if (isApplePencil) {
        return;
      }

      if (!drawingStart.current) return;

      const extensionFeature = createExtensionFeature(
        drawingStart.current,
        getMapCoord(e),
      );

      setDrawingState([extensionFeature]);
    },
    double: (e) => {
      if (selection?.type !== "single") return;

      e.preventDefault();

      if (!multi) {
        setMode({ mode: Mode.NONE });
      } else {
        setSelection(
          USelection.selectionToFolder({
            selection,
            folderMap,
            featureMap,
          }),
        );
      }

      resetDrawingState();

      const extraForDoubleClick = 1;
      popMoment(extraForDoubleClick);
    },
    enter() {
      setMode({ mode: Mode.NONE });

      if (selection.type !== "single") return;

      resetDrawingState();
    },
    touchstart: (e) => {
      usingTouchEvents.current = true;
      e.preventDefault();
    },

    touchmove: (e) => {
      handlers.move(e);
    },

    touchend: (e) => {
      handlers.click(e);
    },

    down: (e) => {
      if (e.type === "mousedown") {
        usingTouchEvents.current = false;
      }
    },
    up() {
      dragTargetRef.current = null;
      setCursor(CURSOR_DEFAULT);
    },
  };

  return handlers;
}
