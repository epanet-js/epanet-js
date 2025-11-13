import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useAtom, useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { useAreaSelection } from "./use-area-selection";
import { polygonCoordinatesFromPositions } from "src/lib/geometry";
import { EphemeralEditingStateAreaSelection } from "./ephemeral-area-selection-state";

export function useRectangularSelectionHandlers(
  context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const { selectAssetsInArea, abort: abortSelection } =
    useAreaSelection(context);

  return {
    down: noop,
    double: noop,
    move: (e) => {
      if (ephemeralState.type !== "areaSelect" || !ephemeralState.isDrawing)
        return;

      const currentPos = getMapCoord(e);
      setEphemeralState(drawingState([ephemeralState.points[0], currentPos]));
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
        setEphemeralState(finishedDrawingState(ephemeralState.points));
        await selectAssetsInArea(closedPolygon);
        setEphemeralState({ type: "none" });
      } else {
        setEphemeralState(drawingState([currentPos, currentPos]));
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
