import { useAtom } from "jotai";
import { useRef } from "react";
import { NodeAsset } from "src/hydraulics/assets";
import { ephemeralStateAtom } from "src/state/jotai";
import { IWrappedFeature } from "src/types";

type NullDrawing = { isNull: true };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      line: IWrappedFeature;
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

  const setDrawing = ({
    startNode,
    line,
  }: {
    startNode: NodeAsset;
    line: IWrappedFeature;
  }) => {
    startNodeRef.current = startNode;
    setEphemeralState({
      type: "drawLine",
      line: line,
    });
  };

  return {
    resetDrawing,
    setDrawing,
    drawing: drawingState,
  };
};
