import bbox from "@turf/bbox";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { Pipe } from "src/hydraulic-model/asset-types";

export interface SubNetwork {
  subnetworkId: number;
  nodeIds: AssetId[];
  linkIds: AssetId[];
  supplySourceCount: number;
  pipeCount: number;
  bounds: [number, number, number, number];
}

export type BinaryData = ArrayBuffer | SharedArrayBuffer;

export type EncodedHydraulicModelForSubnetworks = {
  nodeBuffer: BinaryData;
  linkBuffer: BinaryData;
  idsLookup: string[];
};

export type RunData = Omit<EncodedHydraulicModelForSubnetworks, "idsLookup">;

export type EncodedSubNetworks = {
  subnetworks: {
    subnetworkId: number;
    nodeIndices: number[];
    linkIndices: number[];
    supplySourceCount: number;
    pipeCount: number;
    bounds: [number, number, number, number];
  }[];
};

const UINT32_SIZE = 4;
const UINT8_SIZE = 1;
const FLOAT64_SIZE = 8;
const BUFFER_HEADER_SIZE = UINT32_SIZE;
const NODE_BINARY_SIZE = UINT32_SIZE + UINT8_SIZE;
const LINK_BINARY_SIZE = UINT32_SIZE * 3 + UINT8_SIZE + FLOAT64_SIZE * 4;

const NODE_TYPE_MAP = { junction: 0, tank: 1, reservoir: 2 } as const;
const LINK_TYPE_MAP = { pipe: 0, valve: 1, pump: 2 } as const;

export function encodeHydraulicModelForSubnetworks(
  model: HydraulicModel,
  bufferType: "shared" | "array" = "array",
): EncodedHydraulicModelForSubnetworks {
  const idsLookup: string[] = [];
  const idxLookup = new Map<string, number>();

  const getOrAssignIdx = (id: string) => {
    let idx = idxLookup.get(id);
    if (idx === undefined) {
      idx = idsLookup.length;
      idxLookup.set(id, idx);
      idsLookup.push(id);
    }
    return idx;
  };

  const nodes: { id: number; type: number }[] = [];
  const links: {
    id: number;
    start: number;
    end: number;
    type: number;
    bounds: [number, number, number, number];
  }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = getOrAssignIdx(id);

    if (asset.isLink) {
      const [startId, endId] = (asset as Pipe).connections;
      const start = getOrAssignIdx(startId);
      const end = getOrAssignIdx(endId);

      const linkType =
        LINK_TYPE_MAP[asset.type as keyof typeof LINK_TYPE_MAP] ?? 0;

      const [minX, minY, maxX, maxY] = bbox(asset.feature);

      links.push({
        id: idx,
        start,
        end,
        type: linkType,
        bounds: [minX, minY, maxX, maxY],
      });
    } else {
      const nodeType =
        NODE_TYPE_MAP[asset.type as keyof typeof NODE_TYPE_MAP] ?? 0;
      nodes.push({ id: idx, type: nodeType });
    }
  }

  function encodeNodes(nodes: { id: number; type: number }[]): BinaryData {
    const recordSize = NODE_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + nodes.length * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);

    const view = new DataView(buffer);
    view.setUint32(0, nodes.length, true);
    nodes.forEach((n, i) => {
      let offset = BUFFER_HEADER_SIZE + i * recordSize;
      view.setUint32(offset, n.id, true);
      offset += UINT32_SIZE;
      view.setUint8(offset, n.type);
    });
    return buffer;
  }

  function encodeLinks(
    links: {
      id: number;
      start: number;
      end: number;
      type: number;
      bounds: [number, number, number, number];
    }[],
  ): BinaryData {
    const recordSize = LINK_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + links.length * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);

    const view = new DataView(buffer);
    view.setUint32(0, links.length, true);
    links.forEach((l, i) => {
      let offset = BUFFER_HEADER_SIZE + i * recordSize;
      view.setUint32(offset, l.id, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, l.start, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, l.end, true);
      offset += UINT32_SIZE;
      view.setUint8(offset, l.type);
      offset += UINT8_SIZE;
      view.setFloat64(offset, l.bounds[0], true);
      offset += FLOAT64_SIZE;
      view.setFloat64(offset, l.bounds[1], true);
      offset += FLOAT64_SIZE;
      view.setFloat64(offset, l.bounds[2], true);
      offset += FLOAT64_SIZE;
      view.setFloat64(offset, l.bounds[3], true);
    });
    return buffer;
  }

  return {
    nodeBuffer: encodeNodes(nodes),
    linkBuffer: encodeLinks(links),
    idsLookup: idsLookup,
  };
}

export function decodeSubNetworks(
  idsLookup: string[],
  encodedSubNetworks: EncodedSubNetworks,
): SubNetwork[] {
  return encodedSubNetworks.subnetworks.map((component) => ({
    subnetworkId: component.subnetworkId,
    nodeIds: component.nodeIndices.map((idx) => idsLookup[idx]),
    linkIds: component.linkIndices.map((idx) => idsLookup[idx]),
    supplySourceCount: component.supplySourceCount,
    pipeCount: component.pipeCount,
    bounds: component.bounds,
  }));
}

export interface Node {
  id: number;
  nodeType: number;
}

export interface Link {
  id: number;
  startNode: number;
  endNode: number;
  linkType: number;
  bounds: [number, number, number, number];
}

export class HydraulicModelBufferViewForSubnetworks {
  private nodeView: DataView;
  private linkView: DataView;

  readonly nodeCount: number;
  readonly linkCount: number;

  constructor(
    public readonly nodeBuffer: BinaryData,
    public readonly linkBuffer: BinaryData,
  ) {
    this.nodeView = new DataView(nodeBuffer);
    this.linkView = new DataView(linkBuffer);

    this.nodeCount = this.decodeCount(this.nodeView);
    this.linkCount = this.decodeCount(this.linkView);
  }

  *nodes(): Generator<Node> {
    for (let i = 0; i < this.nodeCount; i++) {
      yield this.decodeNode(this.nodeView, i);
    }
  }

  *links(): Generator<Link> {
    for (let i = 0; i < this.linkCount; i++) {
      yield this.decodeLink(this.linkView, i);
    }
  }

  private decodeCount(view: DataView): number {
    return view.getUint32(0, true);
  }

  private decodeNode(view: DataView, index: number): Node {
    let offset = BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE;
    const id = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const nodeType = view.getUint8(offset);
    return { id, nodeType };
  }

  private decodeLink(view: DataView, index: number): Link {
    let offset = BUFFER_HEADER_SIZE + index * LINK_BINARY_SIZE;
    const id = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const startNode = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const endNode = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const linkType = view.getUint8(offset);
    offset += UINT8_SIZE;
    const minX = view.getFloat64(offset, true);
    offset += FLOAT64_SIZE;
    const minY = view.getFloat64(offset, true);
    offset += FLOAT64_SIZE;
    const maxX = view.getFloat64(offset, true);
    offset += FLOAT64_SIZE;
    const maxY = view.getFloat64(offset, true);
    return {
      id,
      startNode,
      endNode,
      linkType,
      bounds: [minX, minY, maxX, maxY],
    };
  }
}
