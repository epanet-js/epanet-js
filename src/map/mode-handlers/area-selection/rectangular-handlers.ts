import type { HandlerContext } from "src/types";
import {
  modeAtom,
  Mode,
  ephemeralStateAtom,
  cursorStyleAtom,
} from "src/state/jotai";
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
  const setCursor = useSetAtom(cursorStyleAtom);
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

  const updateCursor = () => {
    if (
      ephemeralState.type === "areaSelect" &&
      ephemeralState.isValid === false
    ) {
      setCursor("not-allowed");
    } else {
      const operation = identifyOperation();
      if (operation === "add") setCursor("crosshair-add");
      if (operation === "subtract") setCursor("crosshair-subtract");
      if (!operation) setCursor("crosshair");
    }
  };

  return {
    down: noop,
    double: noop,
    move: (e) => {
      if (ephemeralState.type !== "areaSelect" || !ephemeralState.isDrawing)
        return;

      const currentPos = getMapCoord(e);
      setEphemeralState({
        ...drawingState([ephemeralState.points[0], currentPos]),
        operation: identifyOperation(),
      });
      updateCursor();
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
        setEphemeralState({
          ...finishedDrawingState(ephemeralState.points),
          operation: ephemeralState.operation,
        });
        await selectAssetsInArea(closedPolygon, ephemeralState.operation);
        setEphemeralState({ type: "none" });
      } else {
        identifyOperation;
        setEphemeralState({
          ...drawingState([currentPos, currentPos]),
          operation: identifyOperation(),
        });
      }
    },
    keydown: () => {
      updateCursor();
      setEphemeralState((prev) => {
        if (prev.type !== "areaSelect") return prev;
        return {
          ...prev,
          operation: identifyOperation(),
        };
      });
    },
    keyup: () => {
      updateCursor();
      setEphemeralState((prev) => {
        if (prev.type !== "areaSelect") return prev;
        return {
          ...prev,
          operation: identifyOperation(),
        };
      });
    },
    exit: () => {
      setCursor("default");
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
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_RECTANGULAR,
  points,
  isValid: true,
  isDrawing: true,
});

const finishedDrawingState = (
  points: EphemeralEditingStateAreaSelection["points"],
): EphemeralEditingStateAreaSelection => ({
  type: "areaSelect",
  selectionMode: Mode.SELECT_RECTANGULAR,
  points,
  isValid: true,
  isDrawing: false,
});
