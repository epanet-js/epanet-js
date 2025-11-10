import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useAtom, useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { isLastPolygonSegmentIntersecting } from "src/lib/geometry";
import { useAreaSelection } from "./use-area-selection";

export function usePolygonalSelectionHandlers(
  context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const selectContainedAssets = useAreaSelection(context);

  return {
    down: noop,
    double: () => {
      if (
        ephemeralState.type !== "areaSelect" ||
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
      selectContainedAssets(closedPolygon);
      setEphemeralState({ type: "none" });
    },
    move: (e) => {
      const currentPos = getMapCoord(e);
      setEphemeralState((prev) => {
        if (prev.type !== "areaSelect") return prev;
        const points = [...prev.points];
        points.pop();
        points.push(currentPos);
        return {
          type: "areaSelect",
          selectionMode: Mode.SELECT_POLYGONAL,
          points,
          isValid: !isLastPolygonSegmentIntersecting(points),
        };
      });
      e.preventDefault();
    },
    up: noop,
    click: (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect") {
        if (ephemeralState.isValid)
          setEphemeralState({
            type: "areaSelect",
            selectionMode: Mode.SELECT_POLYGONAL,
            points: [...ephemeralState.points, currentPos],
            isValid: true,
          });
      } else {
        setEphemeralState({
          type: "areaSelect",
          selectionMode: Mode.SELECT_POLYGONAL,
          points: [currentPos, currentPos],
          isValid: true,
        });
      }
    },
    exit: () => {
      if (ephemeralState.type === "areaSelect") {
        setEphemeralState({ type: "none" });
      } else {
        setMode({ mode: Mode.NONE });
      }
    },
  };
}
