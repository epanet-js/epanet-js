import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom, useAtom } from "jotai";
import { useRef } from "react";
import { getMapCoord } from "../utils";
import { isLastPolygonSegmentIntersecting } from "src/lib/geometry";

const MIN_POINTS_DISTANCE_PX = 10;

export function useFreehandSelectionHandlers(
  _context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const lastPixelPointRef = useRef<{ x: number; y: number } | null>(null);

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

        const points = [...prev.points];
        if (!prev.isValid) {
          points.pop();
        }
        points.push(currentPos);
        if (!isLastPolygonSegmentIntersecting(points)) {
          lastPixelPointRef.current = { x: e.point.x, y: e.point.y };
          return {
            type: "areaSelect",
            selectionMode: Mode.SELECT_FREEHAND,
            points,
            isValid: true,
          };
        } else {
          return {
            type: "areaSelect",
            selectionMode: Mode.SELECT_FREEHAND,
            points,
            isValid: false,
          };
        }
      });

      e.preventDefault();
    },
    up: noop,
    click: (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect") {
        if (!ephemeralState.isValid) return;
        if (
          isLastPolygonSegmentIntersecting([
            ...ephemeralState.points,
            ephemeralState.points[0],
          ])
        )
          return;

        setEphemeralState({ type: "none" });
        lastPixelPointRef.current = null;
      } else {
        lastPixelPointRef.current = { x: e.point.x, y: e.point.y };
        setEphemeralState({
          type: "areaSelect",
          selectionMode: Mode.SELECT_FREEHAND,
          points: [currentPos, currentPos],
          isValid: false,
        });
      }
    },
    exit: () => {
      if (ephemeralState.type === "areaSelect") {
        setEphemeralState({ type: "none" });
        lastPixelPointRef.current = null;
      } else {
        setMode({ mode: Mode.NONE });
      }
    },
  };
}
