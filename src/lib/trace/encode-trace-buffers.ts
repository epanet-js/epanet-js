import { HydraulicModel } from "src/hydraulic-model";
import { Asset, Pipe, Valve } from "src/hydraulic-model/asset-types";
import { ResultsReader } from "src/simulation/results-reader";
import {
  BufferType,
  DataSize,
  FixedSizeBufferBuilder,
  IdMapper,
  VariableSizeBufferBuilder,
  createBuffer,
  encodeType,
} from "src/lib/buffers";
import {
  encodeLinkConnections,
  encodeIdsList,
  getIdsListSize,
  EncodedSize,
} from "src/lib/network-review/hydraulic-model-buffers";
import { TraceBuffers } from "./trace-buffers";
import {
  FlowDirection,
  FLOW_TOLERANCE,
  LinkTraversal,
  NodeTraversal,
} from "./types";

export interface EncodedTrace {
  buffers: TraceBuffers;
  nodeIdsLookup: number[];
  linkIdsLookup: number[];
}

export function encodeTraceBuffers(
  model: HydraulicModel,
  resultsReader: ResultsReader | null,
  bufferType: BufferType = "array",
): EncodedTrace {
  const encoder = new TraceBuffersEncoder(model, resultsReader, bufferType);
  return encoder.build();
}

class TraceBuffersEncoder {
  private nodeIdMapper = new IdMapper();
  private linkIdMapper = new IdMapper();
  private totalConnectionsSize = 0;
  private nodeConnectionsCache = new Map<number, number[]>();

  constructor(
    private model: HydraulicModel,
    private resultsReader: ResultsReader | null,
    private bufferType: BufferType,
  ) {}

  build(): EncodedTrace {
    this.prepareMappings();

    const linkConnections = new FixedSizeBufferBuilder<[number, number]>(
      EncodedSize.id * 2,
      this.linkIdMapper.count,
      this.bufferType,
      encodeLinkConnections,
    );

    const linkTraversal = new FixedSizeBufferBuilder<number>(
      DataSize.type,
      this.linkIdMapper.count,
      this.bufferType,
      encodeType,
    );

    const nodeConnections = new VariableSizeBufferBuilder<number[]>(
      this.nodeIdMapper.count,
      this.totalConnectionsSize,
      this.bufferType,
      encodeIdsList,
      getIdsListSize,
    );

    const nodeTraversal = new FixedSizeBufferBuilder<number>(
      DataSize.type,
      this.nodeIdMapper.count,
      this.bufferType,
      encodeType,
    );

    // Encode flow directions if simulation results available
    let flowDirectionsBuffer = null;
    if (this.resultsReader) {
      const buffer = createBuffer(this.linkIdMapper.count, this.bufferType);
      const view = new Uint8Array(buffer);

      for (let linkIdx = 0; linkIdx < this.linkIdMapper.count; linkIdx++) {
        const id = this.linkIdMapper.getId(linkIdx);
        view[linkIdx] = this.getFlowDirection(id);
      }
      flowDirectionsBuffer = buffer;
    }

    // Encode links
    for (let linkIdx = 0; linkIdx < this.linkIdMapper.count; linkIdx++) {
      const id = this.linkIdMapper.getId(linkIdx);
      const asset = this.model.assets.get(id)!;

      this.encodeLinkConnections(asset, linkConnections);
      linkTraversal.add(this.classifyLink(asset));
    }

    // Encode nodes
    for (let nodeIdx = 0; nodeIdx < this.nodeIdMapper.count; nodeIdx++) {
      const id = this.nodeIdMapper.getId(nodeIdx);
      const asset = this.model.assets.get(id)!;

      nodeTraversal.add(this.classifyNode(asset));
      this.encodeNodeConnections(id, nodeConnections);
    }

    return {
      buffers: {
        topology: {
          nodeConnections: nodeConnections.finalize(),
          linkConnections: linkConnections.finalize(),
        },
        linkTraversal: linkTraversal.finalize(),
        nodeTraversal: nodeTraversal.finalize(),
        flowDirections: flowDirectionsBuffer,
      },
      nodeIdsLookup: this.nodeIdMapper.getIdsLookup(),
      linkIdsLookup: this.linkIdMapper.getIdsLookup(),
    };
  }

  private prepareMappings() {
    for (const [id, asset] of this.model.assets) {
      if (asset.isLink) {
        this.linkIdMapper.getOrAssignIdx(id);
      } else {
        this.nodeIdMapper.getOrAssignIdx(id);
        const connectedLinkIds = this.model.topology.getLinks(id);
        this.nodeConnectionsCache.set(id, connectedLinkIds);
        this.totalConnectionsSize += getIdsListSize(connectedLinkIds);
      }
    }
  }

  private encodeLinkConnections(
    asset: Asset,
    linkConnections: FixedSizeBufferBuilder<[number, number]>,
  ) {
    const [startId, endId] = (asset as Pipe).connections;
    const start = this.nodeIdMapper.getIdx(startId);
    const end = this.nodeIdMapper.getIdx(endId);
    linkConnections.add([start, end]);
  }

  private encodeNodeConnections(
    id: number,
    nodeConnections: VariableSizeBufferBuilder<number[]>,
  ) {
    const connectedLinkIds = this.nodeConnectionsCache.get(id) ?? [];
    const connectedLinkIdxs = connectedLinkIds.map((linkId) =>
      this.linkIdMapper.getIdx(linkId),
    );
    nodeConnections.add(connectedLinkIdxs);
  }

  private classifyLink(asset: Asset): number {
    switch (asset.type) {
      case "pipe": {
        const pipe = asset as Pipe;
        if (pipe.initialStatus === "closed") return LinkTraversal.BOUNDARY;
        if (pipe.initialStatus === "cv") return LinkTraversal.ONE_WAY;
        return LinkTraversal.FREE;
      }
      case "valve": {
        const valve = asset as unknown as Valve;
        if (valve.kind === "tcv") {
          return valve.initialStatus === "closed"
            ? LinkTraversal.BOUNDARY
            : LinkTraversal.FREE;
        }
        return LinkTraversal.BOUNDARY;
      }
      case "pump":
        return LinkTraversal.BOUNDARY;
      default:
        return LinkTraversal.FREE;
    }
  }

  private classifyNode(asset: Asset): number {
    switch (asset.type) {
      case "tank":
      case "reservoir":
        return NodeTraversal.BOUNDARY;
      default:
        return NodeTraversal.FREE;
    }
  }

  private getFlowDirection(id: number): number {
    if (!this.resultsReader) return FlowDirection.NONE;

    const asset = this.model.assets.get(id);
    if (!asset) return FlowDirection.NONE;

    let flow: number;
    switch (asset.type) {
      case "pipe":
        flow = this.resultsReader.getPipe(id)?.flow ?? 0;
        break;
      case "valve":
        flow = this.resultsReader.getValve(id)?.flow ?? 0;
        break;
      case "pump":
        flow = this.resultsReader.getPump(id)?.flow ?? 0;
        break;
      default:
        return FlowDirection.NONE;
    }

    if (flow > FLOW_TOLERANCE) return FlowDirection.POSITIVE;
    if (flow < -FLOW_TOLERANCE) return FlowDirection.NEGATIVE;
    return FlowDirection.NONE;
  }
}
