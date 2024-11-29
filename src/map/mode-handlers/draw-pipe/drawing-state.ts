import { useAtom } from "jotai";
import { AssetBuilder } from "src/hydraulic-model";
import { NodeAsset, Pipe } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

type NullDrawing = { isNull: true; snappingCandidate: NodeAsset | null };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      pipe: Pipe;
      snappingCandidate: NodeAsset | null;
    }
  | NullDrawing;

export const useDrawingState = (assetBuilder: AssetBuilder) => {
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
          pipe: state.pipe,
        }
      : { isNull: true, snappingCandidate: null };

  const setSnappingCandidate = (snappingCandidate: NodeAsset | null) => {
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "drawPipe")
        return {
          type: "drawPipe",
          pipe: assetBuilder.buildPipe({ coordinates: [] }),
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
