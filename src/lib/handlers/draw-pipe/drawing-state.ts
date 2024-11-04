import { useAtom } from "jotai";
import { useRef } from "react";
import {
  LinkAsset,
  NodeAsset,
  Pipe,
  createJunction,
  createPipe,
} from "src/hydraulics/assets";
import { ephemeralStateAtom } from "src/state/jotai";
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

export const useDrawingState = () => {
  const startNodeRef = useRef<NodeAsset | null>(null);
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const resetDrawing = () => {
    startNodeRef.current = null;
    setEphemeralState({ type: "none" });
  };

  const drawingState: DrawingState =
    startNodeRef.current && state.type === "drawPipe"
      ? {
          isNull: false,
          startNode: startNodeRef.current,
          snappingCandidate: state.snappingCandidate || null,
          pipe: state.pipe || createPipe([]),
        }
      : { isNull: true, snappingCandidate: null };

  const setSnappingCandidate = (snappingCoordinates: Position | null) => {
    setEphemeralState((prev) => {
      if (prev.type !== "drawPipe")
        return {
          type: "drawPipe",
          snappingCandidate: snappingCoordinates
            ? createJunction(snappingCoordinates)
            : null,
        };

      return {
        ...prev,
        snappingCandidate: snappingCoordinates
          ? createJunction(snappingCoordinates)
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
    startNodeRef.current = startNode;
    setEphemeralState({
      type: "drawPipe",
      pipe,
      startNode,
      snappingCandidate: snappingCoordinates
        ? createJunction(snappingCoordinates)
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
