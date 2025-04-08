import { useAtom } from "jotai";
import { AssetBuilder } from "src/hydraulic-model";
import { NodeAsset, Pump } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

type NullDrawing = { isNull: true; snappingCandidate: NodeAsset | null };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      pump: Pump;
      snappingCandidate: NodeAsset | null;
    }
  | NullDrawing;

export const useDrawingState = (assetBuilder: AssetBuilder) => {
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const resetDrawing = () => {
    setEphemeralState({ type: "none" });
  };

  const drawingState: DrawingState =
    state.type === "drawPump" && state.startNode
      ? {
          isNull: false,
          startNode: state.startNode,
          snappingCandidate: state.snappingCandidate || null,
          pump: state.pump,
        }
      : { isNull: true, snappingCandidate: null };

  const setSnappingCandidate = (snappingCandidate: NodeAsset | null) => {
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "drawPump")
        return {
          type: "drawPump",
          pump: assetBuilder.buildPump({
            label: "",
            coordinates: [],
          }),
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
    pump,
    snappingCandidate,
  }: {
    startNode: NodeAsset;
    pump: Pump;
    snappingCandidate: NodeAsset | null;
  }) => {
    setEphemeralState({
      type: "drawPump",
      pump,
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
