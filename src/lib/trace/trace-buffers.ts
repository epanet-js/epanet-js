import {
  BinaryData,
  BufferWithIndex,
  DataSize,
  FixedSizeBufferView,
  VariableSizeBufferView,
  decodeType,
} from "src/lib/buffers";
import {
  decodeLinkConnections,
  decodeIdsList,
  EncodedSize,
} from "src/lib/network-review/hydraulic-model-buffers";

export interface TraceBuffers {
  topology: {
    nodeConnections: BufferWithIndex;
    linkConnections: BinaryData;
  };
  linkTraversal: BinaryData;
  nodeTraversal: BinaryData;
  flowDirections: BinaryData | null;
}

export class TraceBuffersView {
  private _nodeConnectionsView?: VariableSizeBufferView<number[]>;
  private _linkConnectionsView?: FixedSizeBufferView<[number, number]>;
  private _linkTraversalView?: FixedSizeBufferView<number>;
  private _nodeTraversalView?: FixedSizeBufferView<number>;
  private _flowDirectionsView?: Uint8Array | null;

  constructor(private buffers: TraceBuffers) {}

  get nodeConnections(): VariableSizeBufferView<number[]> {
    if (!this._nodeConnectionsView) {
      this._nodeConnectionsView = new VariableSizeBufferView(
        this.buffers.topology.nodeConnections,
        decodeIdsList,
      );
    }
    return this._nodeConnectionsView;
  }

  get linkConnections(): FixedSizeBufferView<[number, number]> {
    if (!this._linkConnectionsView) {
      this._linkConnectionsView = new FixedSizeBufferView(
        this.buffers.topology.linkConnections,
        EncodedSize.id * 2,
        decodeLinkConnections,
      );
    }
    return this._linkConnectionsView;
  }

  get linkTraversal(): FixedSizeBufferView<number> {
    if (!this._linkTraversalView) {
      this._linkTraversalView = new FixedSizeBufferView(
        this.buffers.linkTraversal,
        DataSize.type,
        decodeType,
      );
    }
    return this._linkTraversalView;
  }

  get nodeTraversal(): FixedSizeBufferView<number> {
    if (!this._nodeTraversalView) {
      this._nodeTraversalView = new FixedSizeBufferView(
        this.buffers.nodeTraversal,
        DataSize.type,
        decodeType,
      );
    }
    return this._nodeTraversalView;
  }

  get flowDirections(): Uint8Array | null {
    if (this._flowDirectionsView === undefined) {
      this._flowDirectionsView = this.buffers.flowDirections
        ? new Uint8Array(this.buffers.flowDirections)
        : null;
    }
    return this._flowDirectionsView;
  }
}
