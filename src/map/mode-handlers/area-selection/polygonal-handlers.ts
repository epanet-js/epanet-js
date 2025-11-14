import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useAtom, useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { isLastPolygonSegmentIntersecting } from "src/lib/geometry";
import { useAreaSelection } from "./use-area-selection";
import { EphemeralEditingStateAreaSelection } from "./ephemeral-area-selection-state";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function usePolygonalSelectionHandlers(
  context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const { selectAssetsInArea, abort: abortSelection } =
    useAreaSelection(context);
  const { isShiftHeld, isAltHeld } = useKeyboardState();
  const isSelectionModificatorsEnabled = useFeatureFlag(
    "FLAG_SELECTION_MODIFICATORS",
  );

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

  return {
    down: noop,
    double: async () => {
      if (
        ephemeralState.type !== "areaSelect" ||
        !ephemeralState.isDrawing ||
        !ephemeralState.isValid ||
        ephemeralState.points.length <= 2
      )
        return;

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
      setEphemeralState(
        finishedDrawingState(closedPolygon, ephemeralState.operation),
      );
      await selectAssetsInArea(closedPolygon, ephemeralState.operation);
      setEphemeralState({ type: "none" });
    },
    move: (e) => {
      const currentPos = getMapCoord(e);
      setEphemeralState((prev) => {
        if (prev.type !== "areaSelect" || !prev.isDrawing) return prev;
        const points = [...prev.points];
        points.pop();
        points.push(currentPos);
        return !isLastPolygonSegmentIntersecting(points)
          ? validDrawingState(points, prev.operation)
          : invalidDrawingState(points, prev.operation);
      });
      e.preventDefault();
    },
    up: noop,
    click: (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect") {
        if (ephemeralState.isValid && ephemeralState.isDrawing) {
          setEphemeralState(
            validDrawingState(
              [...ephemeralState.points, currentPos],
              ephemeralState.operation,
            ),
          );
        }
      } else {
        setEphemeralState(
          invalidDrawingState([currentPos, currentPos], identifyOperation()),
        );
      }
    },
    exit: () => {
      abortSelection();
      if (ephemeralState.type === "areaSelect") {
        setEphemeralState({ type: "none" });
      } else {
        setMode({ mode: Mode.NONE });
      }
    },
  };
}

const validDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
  operation?: "add" | "subtract",
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_POLYGONAL,
  points,
  isValid: true,
  isDrawing: true,
  operation,
});

const invalidDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
  operation?: "add" | "subtract",
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_POLYGONAL,
  points,
  isValid: false,
  isDrawing: true,
  operation,
});

const finishedDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
  operation?: "add" | "subtract",
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_POLYGONAL,
  points,
  isValid: true,
  isDrawing: false,
  operation,
});
