import { useAtom } from "jotai";
import { useRef } from "react";
import { LinkAsset, NodeAsset, Pipe, createPipe } from "src/hydraulics/assets";
import { ephemeralStateAtom } from "src/state/jotai";
import { Position } from "src/types";

type NullDrawing = { isNull: true; snappingCandidate?: Position };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      pipe: LinkAsset;
      snappingCandidate?: Position;
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
          pipe: state.pipe,
        }
      : { isNull: true };

  const setSnappingCandidate = (snappingCandidate: Position | null) => {
    setEphemeralState((prev) => {
      return {
        type: "drawPipe",
        pipe: prev.type === "drawPipe" ? prev.pipe : createPipe([]),
        snappingCandidate,
      };
    });
  };

  const setDrawing = ({
    startNode,
    pipe,
    snappingCandidate,
  }: {
    startNode: NodeAsset;
    pipe: Pipe;
    snappingCandidate?: Position | null;
  }) => {
    startNodeRef.current = startNode;
    setEphemeralState({
      type: "drawPipe",
      pipe,
      snappingCandidate: snappingCandidate || null,
    });
  };

  return {
    resetDrawing,
    setDrawing,
    drawing: drawingState,
    setSnappingCandidate,
  };
};
