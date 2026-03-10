import { atom } from "jotai";
import type { AssetId } from "src/hydraulic-model";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { Position } from "src/types";
import { EphemeralMoveAssets } from "src/map/mode-handlers/none/move-state";
import { EphemeralDrawNode } from "src/map/mode-handlers/draw-node/ephemeral-draw-node-state";
import { EphemeralDrawLink } from "src/map/mode-handlers/draw-link/ephemeral-link-state";
import { EphemeralEditingStateAreaSelection } from "src/map/mode-handlers/area-selection/ephemeral-area-selection-state";

export type EphemeralMoveCustomerPoint = {
  type: "moveCustomerPoint";
  customerPoint: CustomerPoint;
  movedCoordinates: Position;
  startPoint?: { x: number; y: number };
  moveActivated: boolean;
};

export type EphemeralCustomerPointsHighlight = {
  type: "customerPointsHighlight";
  customerPoints: CustomerPoint[];
};

export type EphemeralConnectCustomerPoints = {
  type: "connectCustomerPoints";
  customerPoints: CustomerPoint[];
  targetPipeId?: number;
  snapPoints: Position[];
  strategy: "nearest-to-point" | "cursor";
};

export type EphemeralEditingState =
  | EphemeralDrawLink
  | EphemeralDrawNode
  | EphemeralMoveAssets
  | EphemeralMoveCustomerPoint
  | EphemeralCustomerPointsHighlight
  | EphemeralConnectCustomerPoints
  | EphemeralEditingStateAreaSelection
  | { type: "none" };

export const ephemeralStateAtom = atom<EphemeralEditingState>({ type: "none" });

export const pipeDrawingDefaultsAtom = atom<{
  diameter?: number;
  roughness?: number;
}>({});

export const autoElevationsAtom = atom<boolean>(true);

const noMoved: Set<AssetId> = new Set();

const getMovedAssets = (
  ephemeralState: EphemeralEditingState,
): Set<AssetId> => {
  switch (ephemeralState.type) {
    case "moveAssets":
      return new Set(ephemeralState.oldAssets.map((asset) => asset.id));
    case "drawLink":
      return ephemeralState.sourceLink
        ? new Set([ephemeralState.sourceLink.id])
        : noMoved;
    case "drawNode":
    case "moveCustomerPoint":
    case "customerPointsHighlight":
    case "connectCustomerPoints":
    case "areaSelect":
    case "none":
      return noMoved;
  }
};

export const movedAssetIdsAtom = atom<Set<AssetId>>((get) =>
  getMovedAssets(get(ephemeralStateAtom)),
);
