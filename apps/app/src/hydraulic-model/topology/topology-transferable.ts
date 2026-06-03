import { BinaryData, BufferWithIndex } from "src/lib/buffers";

export interface TopologyBuffers {
  linkConnections: BinaryData;
  nodeConnections: BufferWithIndex;
}

export function topologyTransferables(b: TopologyBuffers): ArrayBuffer[] {
  return [
    b.linkConnections,
    b.nodeConnections.data,
    b.nodeConnections.index,
  ].filter((buf): buf is ArrayBuffer => buf instanceof ArrayBuffer);
}

export { TopologyEncoder } from "./topologyEncoder";
export { TopologyView } from "./topologyView";
