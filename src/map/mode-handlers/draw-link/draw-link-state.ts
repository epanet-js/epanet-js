import { useAtom } from "jotai";
import { AssetBuilder, LinkAsset, LinkType } from "src/hydraulic-model";
import { NodeAsset } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

type NullDrawing = { isNull: true; snappingCandidate: NodeAsset | null };
type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      link: LinkAsset;
      snappingCandidate: NodeAsset | null;
    }
  | NullDrawing;

export const useDrawingState = (
  assetBuilder: AssetBuilder,
  linkType: LinkType,
) => {
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const resetDrawing = () => {
    setEphemeralState({ type: "none" });
  };

  const drawingState: DrawingState =
    state.type === "drawLink" && state.startNode
      ? {
          isNull: false,
          startNode: state.startNode,
          snappingCandidate: state.snappingCandidate || null,
          link: state.link,
        }
      : { isNull: true, snappingCandidate: null };

  const setSnappingCandidate = (snappingCandidate: NodeAsset | null) => {
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "drawLink") {
        let link;
        const startProperties = {
          label: "",
          coordinates: [],
        };
        switch (linkType) {
          case "pipe":
            link = assetBuilder.buildPipe(startProperties);
            break;
          case "pump":
            link = assetBuilder.buildPump(startProperties);
            break;
          case "valve":
            link = assetBuilder.buildValve(startProperties);
            break;
        }
        return {
          type: "drawLink",
          linkType,
          link,
          snappingCandidate,
        };
      }

      return {
        ...prev,
        snappingCandidate,
      };
    });
  };

  const setDrawing = ({
    startNode,
    link,
    snappingCandidate,
  }: {
    startNode: NodeAsset;
    link: LinkAsset;
    snappingCandidate: NodeAsset | null;
  }) => {
    setEphemeralState({
      type: "drawLink",
      link,
      linkType,
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
