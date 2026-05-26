import { BinaryData } from "src/lib/buffers";
import { AssetId } from "src/hydraulic-model/asset-types";
import { AssetIndexView } from "src/hydraulic-model/asset-index";
import {
  FlowDirectionQueries,
  FlowDirection,
  FlowDirectionValue,
  AllowedFlowDirectionQueries,
  AllowedFlowDirection,
  AllowedFlowDirectionValue,
} from "./types";

export interface AllowedFlowDirectionBuffers {
  allowedFlowDirections: BinaryData;
}

export function allowedFlowDirectionTransferables(
  b: AllowedFlowDirectionBuffers,
): ArrayBuffer[] {
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

export interface FlowDirectionBuffers {
  flowDirections: BinaryData;
}

export function flowDirectionTransferables(
  b: FlowDirectionBuffers,
): ArrayBuffer[] {
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
