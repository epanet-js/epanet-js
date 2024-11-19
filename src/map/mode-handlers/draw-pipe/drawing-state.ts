import { useAtom } from "jotai";
import { NodeType, Pipe } from "src/hydraulics/asset-types";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

type NullDrawing = { isNull: true; snappingCandidate: NodeType | null };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeType;
      pipe: Pipe;
      snappingCandidate: NodeType | null;
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
          pipe: state.pipe || Pipe.build({ coordinates: [] }),
        }
      : { isNull: true, snappingCandidate: null };

  const setSnappingCandidate = (snappingCandidate: NodeType | null) => {
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
    startNode: NodeType;
    pipe: Pipe;
    snappingCandidate: NodeType | null;
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
