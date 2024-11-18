import { useAtom } from "jotai";
import { LinkAsset, NodeAsset, Pipe, createPipe } from "src/hydraulics/assets";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

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
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const resetDrawing = () => {
    setEphemeralState({ type: "none" });
  };

  const drawingState: DrawingState =
    state.type === "drawPipe" && state.startNode
      ? {
          isNull: false,
          startNode: state.startNode,
          snappingCandidate: state.snappingCandidate || null,
          pipe: state.pipe || createPipe({ coordinates: [] }),
        }
      : { isNull: true, snappingCandidate: null };

  const setSnappingCandidate = (snappingCandidate: NodeAsset | null) => {
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "drawPipe")
        return {
          type: "drawPipe",
          snappingCandidate,
        };

      return {
        ...prev,
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
    snappingCandidate: NodeAsset | null;
  }) => {
    setEphemeralState({
      type: "drawPipe",
      pipe,
      startNode,
      snappingCandidate,
    });
  };

  return {
    resetDrawing,
    setDrawing,
    drawing: drawingState,
    setSnappingCandidate,
  };
};
