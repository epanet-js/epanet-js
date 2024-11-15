import { useAtom } from "jotai";
import {
  Junction,
  LinkAsset,
  NodeAsset,
  Pipe,
  createJunction,
  createPipe,
} from "src/hydraulics/assets";
import { MapEngine } from "src/map/map-engine";
import { getElevationAt } from "src/map/queries";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";
import { Position } from "src/types";

type NullDrawing = { isNull: true; snappingCandidate: NodeAsset | null };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      pipe: LinkAsset;
      snappingCandidate: NodeAsset | null;
    }
  | NullDrawing;

export const useDrawingState = (map: MapEngine) => {
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const resetDrawing = () => {
    setEphemeralState({ type: "none" });
  };

  const createJunctionAt = (coordinates: Position): Junction => {
    const [lng, lat] = coordinates;
    return createJunction({
      coordinates,
      elevation: getElevationAt(map, { lat, lng }),
    });
  };

  const drawingState: DrawingState =
    state.type === "drawPipe" && state.startNode
      ? {
          isNull: false,
          startNode: state.startNode,
          snappingCandidate: state.snappingCandidate || null,
          pipe: state.pipe || createPipe([]),
        }
      : { isNull: true, snappingCandidate: null };

  const setSnappingCandidate = (snappingCoordinates: Position | null) => {
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "drawPipe")
        return {
          type: "drawPipe",
          snappingCandidate: snappingCoordinates
            ? createJunctionAt(snappingCoordinates)
            : null,
        };

      return {
        ...prev,
        snappingCandidate: snappingCoordinates
          ? createJunctionAt(snappingCoordinates)
          : null,
      };
    });
  };

  const setDrawing = ({
    startNode,
    pipe,
    snappingCoordinates,
  }: {
    startNode: NodeAsset;
    pipe: Pipe;
    snappingCoordinates?: Position | null;
  }) => {
    setEphemeralState({
      type: "drawPipe",
      pipe,
      startNode,
      snappingCandidate: snappingCoordinates
        ? createJunctionAt(snappingCoordinates)
        : null,
    });
  };

  return {
    resetDrawing,
    setDrawing,
    drawing: drawingState,
    setSnappingCandidate,
  };
};
