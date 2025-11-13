import { useRef } from "react";
import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom, useAtom } from "jotai";
import { getMapCoord } from "../utils";
import { isLastPolygonSegmentIntersecting } from "src/lib/geometry";
import { useAreaSelection } from "./use-area-selection";
import { EphemeralEditingStateAreaSelection } from "./ephemeral-area-selection-state";

const MIN_POINTS_DISTANCE_PX = 10;

export function useFreehandSelectionHandlers(
  context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const lastPixelPointRef = useRef<{ x: number; y: number } | null>(null);
  const { selectAssetsInArea, abort: abortSelection } =
    useAreaSelection(context);

  return {
    down: noop,
    double: noop,
    move: (e) => {
      if (ephemeralState.type !== "areaSelect") return;

      if (lastPixelPointRef.current) {
        const dx = Math.abs(e.point.x - lastPixelPointRef.current.x);
        const dy = Math.abs(e.point.y - lastPixelPointRef.current.y);
        if (dx < MIN_POINTS_DISTANCE_PX && dy < MIN_POINTS_DISTANCE_PX) {
          // Skip points that are too close
          return;
        }
      }

      const currentPos = getMapCoord(e);
      setEphemeralState((prev) => {
        if (prev.type !== "areaSelect") return prev;
        if (prev.isDrawing === false) return prev;

        const points = [...prev.points];
        if (!prev.isValid) {
          points.pop();
        }
        points.push(currentPos);
        if (!isLastPolygonSegmentIntersecting(points)) {
          lastPixelPointRef.current = { x: e.point.x, y: e.point.y };
          return validDrawingState(points);
        } else {
          return invalidDrawingState(points);
        }
      });

      e.preventDefault();
    },
    up: noop,
    click: async (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect" && ephemeralState.isDrawing) {
        if (!ephemeralState.isValid) return;
        if (
          isLastPolygonSegmentIntersecting([
            ...ephemeralState.points,
            ephemeralState.points[0],
          ])
        )
          return;

        const closedPolygon = [
          ...ephemeralState.points,
          ephemeralState.points[0],
        ];
        setEphemeralState(finishedDrawingState(closedPolygon));
        await selectAssetsInArea(closedPolygon);
        setEphemeralState({ type: "none" });
        lastPixelPointRef.current = null;
      } else {
        lastPixelPointRef.current = { x: e.point.x, y: e.point.y };
        setEphemeralState(invalidDrawingState([currentPos, currentPos]));
      }
    },
    exit: () => {
      abortSelection();
      if (ephemeralState.type === "areaSelect") {
        setEphemeralState({ type: "none" });
        lastPixelPointRef.current = null;
      } else {
        setMode({ mode: Mode.NONE });
      }
    },
  };
}

const validDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_FREEHAND,
  points,
  isValid: true,
  isDrawing: true,
});

const invalidDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_FREEHAND,
  points,
  isValid: false,
  isDrawing: true,
});

const finishedDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_FREEHAND,
  points,
  isValid: true,
  isDrawing: false,
});
