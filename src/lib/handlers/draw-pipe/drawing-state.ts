import { useAtom } from "jotai";
import { useRef } from "react";
import { NodeAsset, createPipe } from "src/hydraulics/assets";
import { ephemeralStateAtom } from "src/state/jotai";
import { IWrappedFeature, Position } from "src/types";

type NullDrawing = { isNull: true; snappingCandidate?: Position };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      line: IWrappedFeature;
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
    startNodeRef.current && state.type === "drawLine"
      ? { isNull: false, startNode: startNodeRef.current, line: state.line }
      : { isNull: true };

  const setSnappingCandidate = (snappingCandidate: Position | null) => {
    setEphemeralState((prev) => {
      return {
        type: "drawLine",
        line: prev.type === "drawLine" ? prev.line : createPipe([]),
        snappingCandidate,
      };
    });
  };

  const setDrawing = ({
    startNode,
    line,
    snappingCandidate,
  }: {
    startNode: NodeAsset;
    line: IWrappedFeature;
    snappingCandidate?: Position | null;
  }) => {
    startNodeRef.current = startNode;
    setEphemeralState({
      type: "drawLine",
      line: line,
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
