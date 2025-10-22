import { useAtom } from "jotai";
import { useRef } from "react";
import mapboxgl from "mapbox-gl";
import { Asset } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type EphemeralMoveAssets = {
  type: "moveAssets";
  oldAssets: Asset[];
  targetAssets: Asset[];
  startPoint?: mapboxgl.Point;
  moveActivated?: boolean;
  pipeSnappingPosition?: [number, number];
  pipeId?: string;
  nodeSnappingId?: string;
};

const nullPoint = new mapboxgl.Point(0, 0);

export const useMoveState = () => {
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);
  const isCommittingRef = useRef(false);

  const setStartPoint = (startPoint: mapboxgl.Point) => {
    setEphemeralState({
      type: "moveAssets",
      startPoint,
      oldAssets: [],
      targetAssets: [],
      moveActivated: false,
    });
  };

  const updateMove = (targetAssets: Asset[]) => {
    if (isCommittingRef.current) return;

    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "moveAssets") {
        return {
          type: "moveAssets",
          startPoint: nullPoint,
          targetAssets,
          oldAssets: targetAssets,
        } as EphemeralMoveAssets;
      }

      return {
        ...prev,
        targetAssets,
        oldAssets: prev.oldAssets.length > 0 ? prev.oldAssets : targetAssets,
      };
    });
  };

  const updateMoveWithSnapping = (
    targetAssets: Asset[],
    snappingInfo?: {
      pipeSnappingPosition?: [number, number];
      pipeId?: string;
      nodeSnappingId?: string;
    },
  ) => {
    if (isCommittingRef.current) return;

    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "moveAssets") {
        return {
          type: "moveAssets",
          startPoint: nullPoint,
          targetAssets,
          oldAssets: targetAssets,
          moveActivated: true,
          pipeSnappingPosition: snappingInfo?.pipeSnappingPosition,
          pipeId: snappingInfo?.pipeId,
          nodeSnappingId: snappingInfo?.nodeSnappingId,
        } as EphemeralMoveAssets;
      }

      return {
        ...prev,
        targetAssets,
        oldAssets: prev.oldAssets.length > 0 ? prev.oldAssets : targetAssets,
        moveActivated: true,
        pipeSnappingPosition: snappingInfo?.pipeSnappingPosition,
        pipeId: snappingInfo?.pipeId,
        nodeSnappingId: snappingInfo?.nodeSnappingId,
      };
    });
  };

  const resetMove = () => {
    setEphemeralState({ type: "none" });
  };

  const startCommit = () => {
    isCommittingRef.current = true;
  };

  const finishCommit = () => {
    isCommittingRef.current = false;
  };

  const isCommitting = isCommittingRef.current;
  const hasEphemeralFeedback =
    state.type === "moveAssets" && state.targetAssets.length > 0;
  const moveActivated =
    state.type === "moveAssets" ? (state.moveActivated ?? false) : false;

  return {
    setStartPoint,
    startPoint: (state as EphemeralMoveAssets).startPoint,
    updateMove,
    updateMoveWithSnapping,
    resetMove,
    startCommit,
    finishCommit,
    isCommitting,
    isMoving: state.type === "moveAssets",
    hasEphemeralFeedback,
    moveActivated,
  };
};
