import {
  BinaryData,
  DataSize,
  FixedSizeBufferView,
  decodeType,
} from "src/lib/buffers";
import { AssetId } from "src/hydraulic-model/asset-types";
import { AssetIndexView } from "src/hydraulic-model/asset-index";
import {
  TraceStatusQueries,
  FlowDirection,
  FlowDirectionValue,
  LinkTraversalValue,
  NodeTraversal,
  NodeTraversalValue,
} from "./types";

export interface TraceStatusBuffers {
  linkTraversal: BinaryData;
  nodeTraversal: BinaryData;
  flowDirections: BinaryData;
}

export class TraceStatusView implements TraceStatusQueries {
  private _linkTraversalView?: FixedSizeBufferView<number>;
  private _nodeTraversalView?: FixedSizeBufferView<number>;
  private _flowDirectionsView?: Uint8Array;

  constructor(
    private buffers: TraceStatusBuffers,
    private assetIndex: AssetIndexView,
  ) {}

  private get linkTraversalView(): FixedSizeBufferView<number> {
    if (!this._linkTraversalView) {
      this._linkTraversalView = new FixedSizeBufferView(
        this.buffers.linkTraversal,
        DataSize.type,
        decodeType,
      );
    }
    return this._linkTraversalView;
  }

  private get nodeTraversalView(): FixedSizeBufferView<number> {
    if (!this._nodeTraversalView) {
      this._nodeTraversalView = new FixedSizeBufferView(
        this.buffers.nodeTraversal,
        DataSize.type,
        decodeType,
      );
    }
    return this._nodeTraversalView;
  }

  private get flowDirectionsArray(): Uint8Array {
    if (!this._flowDirectionsView) {
      this._flowDirectionsView = new Uint8Array(this.buffers.flowDirections);
    }
    return this._flowDirectionsView;
  }

  getNodeTraversal(nodeId: AssetId): NodeTraversalValue {
    const idx = this.assetIndex.getNodeIndex(nodeId);
    if (idx === null) return NodeTraversal.FREE;
    return this.nodeTraversalView.getById(idx) as NodeTraversalValue;
  }

  getLinkTraversal(linkId: AssetId): LinkTraversalValue {
    const idx = this.assetIndex.getLinkIndex(linkId);
    if (idx === null) return 0 as LinkTraversalValue;
    return this.linkTraversalView.getById(idx) as LinkTraversalValue;
  }

  getFlowDirection(linkId: AssetId): FlowDirectionValue {
    const idx = this.assetIndex.getLinkIndex(linkId);
    if (idx === null) return FlowDirection.NONE;
    return this.flowDirectionsArray[idx] as FlowDirectionValue;
  }
}
