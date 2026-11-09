import { BinaryData } from "@epanet-js/buffers";
import {
  AssetId,
  AllowedFlowDirection,
  type AllowedFlowDirectionQueries,
  type AllowedFlowDirectionValue,
  type ActiveTopologyQueries,
} from "@epanet-js/hydraulic-model";
import { AssetIndexView } from "src/hydraulic-model/asset-index-transferable";
import {
  FlowDirectionQueries,
  FlowDirection,
  FlowDirectionValue,
} from "./types";

export interface AllowedFlowDirectionBuffers {
  allowedFlowDirections: BinaryData;
}

export function allowedFlowDirectionTransferables(
  b: AllowedFlowDirectionBuffers | null,
): ArrayBuffer[] {
  if (b === null) return [];
  return b.allowedFlowDirections instanceof ArrayBuffer
    ? [b.allowedFlowDirections]
    : [];
}

export class AllowedFlowDirectionView implements AllowedFlowDirectionQueries {
  private _view?: Uint8Array;

  constructor(
    private buffers: AllowedFlowDirectionBuffers,
    private assetIndex: AssetIndexView,
  ) {}

  private get array(): Uint8Array {
    if (!this._view) {
      this._view = new Uint8Array(this.buffers.allowedFlowDirections);
    }
    return this._view;
  }

  getAllowedFlowDirection(linkId: AssetId): AllowedFlowDirectionValue {
    const idx = this.assetIndex.getLinkIndex(linkId);
    if (idx === null) return AllowedFlowDirection.NONE;
    return this.array[idx] as AllowedFlowDirectionValue;
  }
}

export interface ActiveTopologyBuffers {
  activeLinks: BinaryData;
  activeNodes: BinaryData;
}

export function activeTopologyTransferables(
  b: ActiveTopologyBuffers | null,
): ArrayBuffer[] {
  if (b === null) return [];
  return [b.activeLinks, b.activeNodes].filter(
    (buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer,
  );
}

export class ActiveTopologyView implements ActiveTopologyQueries {
  private _activeLinks?: Uint8Array;
  private _activeNodes?: Uint8Array;

  constructor(
    private buffers: ActiveTopologyBuffers,
    private assetIndex: AssetIndexView,
  ) {}

  private get activeLinks(): Uint8Array {
    if (!this._activeLinks) {
      this._activeLinks = new Uint8Array(this.buffers.activeLinks);
    }
    return this._activeLinks;
  }

  private get activeNodes(): Uint8Array {
    if (!this._activeNodes) {
      this._activeNodes = new Uint8Array(this.buffers.activeNodes);
    }
    return this._activeNodes;
  }

  isLinkActive(linkId: AssetId): boolean {
    const idx = this.assetIndex.getLinkIndex(linkId);
    if (idx === null) return false;
    return this.activeLinks[idx] === 1;
  }

  isNodeActive(nodeId: AssetId): boolean {
    const idx = this.assetIndex.getNodeIndex(nodeId);
    if (idx === null) return false;
    return this.activeNodes[idx] === 1;
  }
}

export interface FlowDirectionBuffers {
  flowDirections: BinaryData;
}

export function flowDirectionTransferables(
  b: FlowDirectionBuffers | null,
): ArrayBuffer[] {
  if (b === null) return [];
  return b.flowDirections instanceof ArrayBuffer ? [b.flowDirections] : [];
}

export class FlowDirectionView implements FlowDirectionQueries {
  private _flowDirectionsView?: Uint8Array;

  constructor(
    private buffers: FlowDirectionBuffers,
    private assetIndex: AssetIndexView,
  ) {}

  private get flowDirectionsArray(): Uint8Array {
    if (!this._flowDirectionsView) {
      this._flowDirectionsView = new Uint8Array(this.buffers.flowDirections);
    }
    return this._flowDirectionsView;
  }

  getFlowDirection(linkId: AssetId): FlowDirectionValue {
    const idx = this.assetIndex.getLinkIndex(linkId);
    if (idx === null) return FlowDirection.NONE;
    return this.flowDirectionsArray[idx] as FlowDirectionValue;
  }
}
