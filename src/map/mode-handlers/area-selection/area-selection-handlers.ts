import { useRef } from "react";
import type { HandlerContext } from "src/types";
import {
  modeAtom,
  Mode,
  ephemeralStateAtom,
  cursorStyleAtom,
  EphemeralEditingState,
} from "src/state/jotai";
import noop from "lodash/noop";
import { useAtom, useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import {
  isLastPolygonSegmentIntersecting,
  polygonCoordinatesFromPositions,
} from "src/lib/geometry";
import { useAreaSelection } from "./use-area-selection";
import type { EphemeralEditingStateAreaSelection } from "./ephemeral-area-selection-state";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import mapboxgl from "mapbox-gl";

const MIN_POINTS_DISTANCE_PX = 10;

type SelectionMode = "rectangular" | "polygonal" | "freehand";

type MapMouseEvent = mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent;

export function useAreaSelectionHandlers({
  selectionMode,
  ...context
}: HandlerContext & { selectionMode: SelectionMode }): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const { selectAssetsInArea, abort: abortSelection } =
    useAreaSelection(context);
  const { isShiftHeld, isAltHeld } = useKeyboardState();
  const isSelectionModificatorsEnabled = useFeatureFlag(
    "FLAG_SELECTION_MODIFICATORS",
  );

  const drawingState = ephemeralState as EphemeralEditingStateAreaSelection;

  const lastPixelPointRef = useRef<{ x: number; y: number } | null>(null);
  const isTooCloseToLastPoint = (x: number, y: number): boolean => {
    if (lastPixelPointRef.current) {
      const dx = Math.abs(x - lastPixelPointRef.current.x);
      const dy = Math.abs(y - lastPixelPointRef.current.y);
      if (dx < MIN_POINTS_DISTANCE_PX && dy < MIN_POINTS_DISTANCE_PX) {
        return true;
      }
    }
    return false;
  };

  const getMode = () => {
    switch (selectionMode) {
      case "rectangular":
        return Mode.SELECT_RECTANGULAR;
      case "polygonal":
        return Mode.SELECT_POLYGONAL;
      case "freehand":
        return Mode.SELECT_FREEHAND;
    }
  };

  const isDrawing = (state: EphemeralEditingState) => {
    return state.type == "areaSelect" && state.isDrawing;
  };

  const identifyOperation = (): "add" | "subtract" | undefined => {
    if (isSelectionModificatorsEnabled) {
      if (isAltHeld()) {
        return "subtract";
      } else if (isShiftHeld()) {
        return "add";
      }
    }
    return undefined;
  };

  const updateCursor = () => {
    if (drawingState.type === "areaSelect" && drawingState.isValid === false) {
      setCursor("not-allowed");
    } else {
      const operation = identifyOperation();
      if (operation === "add") setCursor("crosshair-add");
      if (operation === "subtract") setCursor("crosshair-subtract");
      if (!operation) setCursor("crosshair");
    }
  };

  const updateOperation = () => {
    if (drawingState.type !== "areaSelect") return;
    setEphemeralState((prev) => {
      return {
        ...prev,
        operation: identifyOperation(),
      };
    });
  };

  const startDrawing = (e: MapMouseEvent, isValid = true) => {
    const coord = getMapCoord(e);
    lastPixelPointRef.current = { x: e.point.x, y: e.point.y };
    setEphemeralState({
      type: "areaSelect",
      selectionMode: getMode(),
      points: [coord, coord],
      isValid,
      isDrawing: true,
      operation: identifyOperation(),
    });
  };

  const replaceLastDrawingPoint = (e: MapMouseEvent) => {
    const currentPos = getMapCoord(e);
    setEphemeralState((prev) => {
      if (!isDrawing(prev)) return prev;
      const state = prev as EphemeralEditingStateAreaSelection;
      const points = state.points;
      points.pop();
      points.push(currentPos);
      if (!isLastPolygonSegmentIntersecting(points)) {
        lastPixelPointRef.current = { x: e.point.x, y: e.point.y };
        return { ...state, points, isValid: true };
      } else {
        return { ...state, points, isValid: false };
      }
    });
  };

  const appendDrawingPoint = (e: MapMouseEvent) => {
    const currentPos = getMapCoord(e);
    setEphemeralState((prev) => {
      if (!isDrawing(prev)) return prev;
      const state = prev as EphemeralEditingStateAreaSelection;
      const points = state.points;

      if (!state.isValid) {
        points.pop();
      }
      points.push(currentPos);
      if (!isLastPolygonSegmentIntersecting(points)) {
        lastPixelPointRef.current = { x: e.point.x, y: e.point.y };
        return { ...state, points, isValid: true };
      } else {
        return { ...state, points, isValid: false };
      }
    });
  };

  const getClosedPolygon = ():
    | EphemeralEditingStateAreaSelection["points"]
    | undefined => {
    if (
      !isDrawing(drawingState) ||
      !drawingState.isValid ||
      drawingState.points.length <= 2
    )
      return;

    const closedPolygon = [...drawingState.points, drawingState.points[0]];

    if (isLastPolygonSegmentIntersecting(closedPolygon)) return;

    return closedPolygon;
  };

  const finishDrawing = (points: Pos2[]) => {
    setEphemeralState({
      type: "areaSelect",
      selectionMode: getMode(),
      points,
      isValid: true,
      isDrawing: false,
      operation: identifyOperation(),
    });
  };

  const resetDrawingState = () => {
    setEphemeralState({ type: "none" });
    lastPixelPointRef.current = null;
  };

  const modeHandlers = {
    rectangular: {
      move: (e: MapMouseEvent) => {
        replaceLastDrawingPoint(e);
        updateCursor();
        e.preventDefault();
      },
      click: async (e: MapMouseEvent) => {
        if (isDrawing(ephemeralState)) {
          finishDrawing(drawingState.points);
          await selectAssetsInArea(
            polygonCoordinatesFromPositions(
              drawingState.points[0],
              drawingState.points[1],
            )[0],
            drawingState.operation,
          );
          resetDrawingState();
        } else {
          startDrawing(e);
        }
      },
      double: noop,
    },
    polygonal: {
      move: (e: MapMouseEvent) => {
        replaceLastDrawingPoint(e);
        updateCursor();
        e.preventDefault();
      },
      click: (e: MapMouseEvent) => {
        if (isDrawing(drawingState)) {
          appendDrawingPoint(e);
        } else {
          startDrawing(e, false);
        }
      },
      double: async () => {
        if (!isDrawing(drawingState)) return;
        const closedPolygon = getClosedPolygon();
        if (!closedPolygon) return;
        finishDrawing(closedPolygon);
        await selectAssetsInArea(closedPolygon, drawingState.operation);
        resetDrawingState();
      },
    },
    freehand: {
      move: (e: MapMouseEvent) => {
        if (ephemeralState.type !== "areaSelect") return;
        if (isTooCloseToLastPoint(e.point.x, e.point.y)) return;

        appendDrawingPoint(e);
        updateCursor();
        e.preventDefault();
      },
      click: async (e: MapMouseEvent) => {
        if (isDrawing(drawingState)) {
          const closedPolygon = getClosedPolygon();
          if (!closedPolygon) return;
          finishDrawing(closedPolygon);
          await selectAssetsInArea(closedPolygon, drawingState.operation);
          resetDrawingState();
        } else {
          startDrawing(e, false);
        }
      },
      double: noop,
    },
  };

  return {
    down: noop,
    up: noop,
    move: modeHandlers[selectionMode].move,
    click: modeHandlers[selectionMode].click,
    double: modeHandlers[selectionMode].double,
    keydown: () => {
      updateCursor();
      updateOperation();
    },
    keyup: () => {
      updateCursor();
      updateOperation();
    },
    exit: () => {
      setCursor("default");
      abortSelection();
      if (ephemeralState.type === "areaSelect") {
        resetDrawingState();
      } else {
        setMode({ mode: Mode.NONE });
      }
    },
  };
}
