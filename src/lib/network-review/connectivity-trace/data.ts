import bbox from "@turf/bbox";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { Pipe } from "src/hydraulic-model/asset-types";
import {
  BinaryData,
  BufferType,
  IdMapper,
  UINT32_SIZE,
  UINT8_SIZE,
  FLOAT64_SIZE,
  BUFFER_HEADER_SIZE,
  createBuffer,
  encodeCount,
  decodeCount,
} from "../shared";

export interface SubNetwork {
  subnetworkId: number;
  nodeIds: AssetId[];
  linkIds: AssetId[];
  supplySourceCount: number;
  pipeCount: number;
  bounds: [number, number, number, number];
}

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

const NODE_BINARY_SIZE = UINT32_SIZE + UINT8_SIZE;
const LINK_BINARY_SIZE = UINT32_SIZE * 3 + UINT8_SIZE + FLOAT64_SIZE * 4;

const NODE_TYPE_MAP = { junction: 0, tank: 1, reservoir: 2 } as const;
const LINK_TYPE_MAP = { pipe: 0, valve: 1, pump: 2 } as const;

export function encodeHydraulicModelForSubnetworks(
  model: HydraulicModel,
  bufferType: BufferType = "array",
): EncodedHydraulicModelForSubnetworks {
  const idMapper = new IdMapper();

  const nodes: { id: number; type: number }[] = [];
  const links: {
    id: number;
    start: number;
    end: number;
    type: number;
    bounds: [number, number, number, number];
  }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = idMapper.getOrAssignIdx(id);

    if (asset.isLink) {
      const [startId, endId] = (asset as Pipe).connections;
      const start = idMapper.getOrAssignIdx(startId);
      const end = idMapper.getOrAssignIdx(endId);

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

  return {
    nodeBuffer: encodeNodesBuffer(nodes, bufferType),
    linkBuffer: encodeLinksBuffer(links, bufferType),
    idsLookup: idMapper.getIdsLookup(),
  };
}

function encodeNodesBuffer(
  nodes: { id: number; type: number }[],
  bufferType: BufferType,
): BinaryData {
  const recordSize = NODE_BINARY_SIZE;
  const totalSize = BUFFER_HEADER_SIZE + nodes.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);

  const view = new DataView(buffer);
  encodeCount(view, nodes.length);
  nodes.forEach((n, i) => {
    let offset = BUFFER_HEADER_SIZE + i * recordSize;
    view.setUint32(offset, n.id, true);
    offset += UINT32_SIZE;
    view.setUint8(offset, n.type);
  });
  return buffer;
}

function encodeLinksBuffer(
  links: {
    id: number;
    start: number;
    end: number;
    type: number;
    bounds: [number, number, number, number];
  }[],
  bufferType: BufferType,
): BinaryData {
  const recordSize = LINK_BINARY_SIZE;
  const totalSize = BUFFER_HEADER_SIZE + links.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);

  const view = new DataView(buffer);
  encodeCount(view, links.length);
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

    this.nodeCount = decodeCount(this.nodeView);
    this.linkCount = decodeCount(this.linkView);
  }

  *nodes(): Generator<Node> {
    for (let i = 0; i < this.nodeCount; i++) {
      let offset = BUFFER_HEADER_SIZE + i * NODE_BINARY_SIZE;
      const id = this.nodeView.getUint32(offset, true);
      offset += UINT32_SIZE;
      const nodeType = this.nodeView.getUint8(offset);
      yield { id, nodeType };
    }
  }

  *links(): Generator<Link> {
    for (let i = 0; i < this.linkCount; i++) {
      let offset = BUFFER_HEADER_SIZE + i * LINK_BINARY_SIZE;
      const id = this.linkView.getUint32(offset, true);
      offset += UINT32_SIZE;
      const startNode = this.linkView.getUint32(offset, true);
      offset += UINT32_SIZE;
      const endNode = this.linkView.getUint32(offset, true);
      offset += UINT32_SIZE;
      const linkType = this.linkView.getUint8(offset);
      offset += UINT8_SIZE;
      const minX = this.linkView.getFloat64(offset, true);
      offset += FLOAT64_SIZE;
      const minY = this.linkView.getFloat64(offset, true);
      offset += FLOAT64_SIZE;
      const maxX = this.linkView.getFloat64(offset, true);
      offset += FLOAT64_SIZE;
      const maxY = this.linkView.getFloat64(offset, true);
      yield {
        id,
        startNode,
        endNode,
        linkType,
        bounds: [minX, minY, maxX, maxY],
      };
    }
  }
}
