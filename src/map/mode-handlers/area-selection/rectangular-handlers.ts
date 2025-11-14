import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useAtom, useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { useAreaSelection } from "./use-area-selection";
import { polygonCoordinatesFromPositions } from "src/lib/geometry";
import { EphemeralEditingStateAreaSelection } from "./ephemeral-area-selection-state";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function useRectangularSelectionHandlers(
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
    double: noop,
    move: (e) => {
      if (ephemeralState.type !== "areaSelect" || !ephemeralState.isDrawing)
        return;

      const currentPos = getMapCoord(e);
      setEphemeralState(
        drawingState(
          [ephemeralState.points[0], currentPos],
          ephemeralState.operation,
        ),
      );
      e.preventDefault();
    },
    up: noop,
    click: async (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect" && ephemeralState.isDrawing) {
        const closedPolygon = polygonCoordinatesFromPositions(
          ephemeralState.points[0],
          ephemeralState.points[1],
        )[0];
        setEphemeralState(
          finishedDrawingState(ephemeralState.points, ephemeralState.operation),
        );
        await selectAssetsInArea(closedPolygon, ephemeralState.operation);
        setEphemeralState({ type: "none" });
      } else {
        identifyOperation;
        setEphemeralState(
          drawingState([currentPos, currentPos], identifyOperation()),
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

const drawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
  operation?: "add" | "subtract",
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_RECTANGULAR,
  points,
  isValid: true,
  isDrawing: true,
  operation,
});

const finishedDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
  operation?: "add" | "subtract",
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_RECTANGULAR,
  points,
  isValid: true,
  isDrawing: false,
  operation,
});
