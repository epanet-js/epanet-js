import {
  BufferType,
  DataSize,
  decodeNumber,
  encodeNumber,
  FixedSizeBufferBuilder,
  VariableSizeBufferBuilder,
} from "src/lib/buffers";
import { AssetId } from "../asset-types/base-asset";
import { AssetIndexQueries } from "../asset-index";
import { TopologyQueries, TopologyBuffers } from "./types";

function encodeLinkConnections(
  connections: [number, number],
  offset: number,
  view: DataView,
): void {
  encodeNumber(connections[0], offset, view);
  encodeNumber(connections[1], offset + DataSize.number, view);
}

export function decodeLinkConnections(
  offset: number,
  view: DataView,
): [number, number] {
  return [
    decodeNumber(offset, view),
    decodeNumber(offset + DataSize.number, view),
  ];
}

function encodeNodeConnections(
  connectedLinkIds: number[],
  offset: number,
  view: DataView,
): number {
  encodeNumber(connectedLinkIds.length, offset, view);
  connectedLinkIds.forEach((linkId, idx) => {
    encodeNumber(
      linkId,
      offset + DataSize.number + idx * DataSize.number,
      view,
    );
  });

  return offset;
}

function getNodeConnectionsSize(data: number[]): number {
  return DataSize.number + data.length * DataSize.number;
}

export function decodeNodeConnections(
  offset: number,
  view: DataView,
): number[] {
  const ids: number[] = [];
  const count = decodeNumber(offset, view);

  for (let i = 0; i < count; i++) {
    const id = decodeNumber(
      offset + DataSize.number + i * DataSize.number,
      view,
    );
    ids.push(id);
  }

  return ids;
}

export class TopologyEncoder {
  private linkConnectionsBuilder: FixedSizeBufferBuilder<[number, number]>;
  private nodeConnectionsBuilder: VariableSizeBufferBuilder<number[]>;

  constructor(
    private topology: TopologyQueries,
    private assetIndex: AssetIndexQueries,
    private bufferType: BufferType = "array",
  ) {
    this.linkConnectionsBuilder = new FixedSizeBufferBuilder<[number, number]>(
      DataSize.number * 2,
      this.assetIndex.linkCount,
      this.bufferType,
      encodeLinkConnections,
    );

    const totalNodeConnectionsSize = this.calculateTotalNodeConnectionsSize();

    this.nodeConnectionsBuilder = new VariableSizeBufferBuilder<number[]>(
      this.assetIndex.nodeCount,
      totalNodeConnectionsSize,
      this.bufferType,
      encodeNodeConnections,
      getNodeConnectionsSize,
    );
  }

  encode(): TopologyBuffers {
    for (const [linkId] of this.assetIndex.iterateLinks()) {
      this.encodeLink(linkId);
    }

    for (const [nodeId] of this.assetIndex.iterateNodes()) {
      this.encodeNode(nodeId);
    }

    return this.finalize();
  }

  private calculateTotalNodeConnectionsSize(): number {
    let totalSize = 0;

    for (const [nodeId] of this.assetIndex.iterateNodes()) {
      const connectedLinkIds = this.topology.getLinks(nodeId);
      totalSize += getNodeConnectionsSize(connectedLinkIds);
    }

    return totalSize;
  }

  encodeLink(linkId: AssetId): void {
    const [startNode, endNode] = this.topology.getNodes(linkId);
    this.linkConnectionsBuilder.add([startNode, endNode]);
  }

  encodeNode(nodeId: AssetId): void {
    const connectedLinkIds = this.topology.getLinks(nodeId);
    this.nodeConnectionsBuilder.add(connectedLinkIds);
  }

  finalize(): TopologyBuffers {
    if (!this.linkConnectionsBuilder || !this.nodeConnectionsBuilder) {
      throw new Error("prepareBuffers must be called before finalize");
    }

    return {
      linkConnections: this.linkConnectionsBuilder.finalize(),
      nodeConnections: this.nodeConnectionsBuilder.finalize(),
    };
  }
}
