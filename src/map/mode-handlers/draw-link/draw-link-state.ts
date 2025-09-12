import { Position } from "geojson";
import { useAtom } from "jotai";
import {
  AssetBuilder,
  AssetId,
  LinkAsset,
  LinkType,
} from "src/hydraulic-model";
import { NodeAsset } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type SnappingCandidate =
  | NodeAsset
  | { type: "pipe"; id: AssetId; coordinates: Position };

type NullDrawing = {
  isNull: true;
  snappingCandidate: SnappingCandidate | null;
};

type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      startPipeId?: AssetId;
      link: LinkAsset;
      snappingCandidate: SnappingCandidate | null;
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
          startPipeId: state.startPipeId,
          snappingCandidate: state.snappingCandidate || null,
          link: state.link,
        }
      : {
          isNull: true,
          snappingCandidate:
            state.type == "drawLink" ? state.snappingCandidate : null,
        };

  const setSnappingCandidate = (
    snappingCandidate: SnappingCandidate | null,
  ) => {
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

      if (prev.snappingCandidate === snappingCandidate) {
        return prev;
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
    startPipeId,
  }: {
    startNode: NodeAsset;
    link: LinkAsset;
    snappingCandidate: SnappingCandidate | null;
    startPipeId?: AssetId;
  }) => {
    setEphemeralState({
      type: "drawLink",
      link,
      linkType,
      startNode,
      startPipeId,
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
