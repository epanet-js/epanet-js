import { Pipe, AssetType, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import {
  BinaryData,
  BufferType,
  IdMapper,
  UINT32_SIZE,
  BUFFER_HEADER_SIZE,
  createBuffer,
  encodeCount,
  decodeCount,
  encodeNodeId,
  decodeNodeId,
  encodeLink,
  decodeLink,
} from "../shared";

export type EncodedHydraulicModel = {
  nodeBuffer: BinaryData;
  pipeBuffer: BinaryData;
  otherLinkBuffer: BinaryData;
  idsLookup: string[];
};

export type RunData = Omit<EncodedHydraulicModel, "idsLookup">;

export type EncodedOrphanAssets = {
  orphanNodes: number[];
  orphanLinks: number[];
};

export interface OrphanAsset {
  assetId: AssetId;
  type: AssetType;
  label: string;
}

const NODE_BINARY_SIZE = UINT32_SIZE;
const LINK_BINARY_SIZE = UINT32_SIZE * 3;

export function encodeHydraulicModel(
  model: HydraulicModel,
  bufferType: BufferType = "array",
): EncodedHydraulicModel {
  const idMapper = new IdMapper();

  const nodes: { id: number }[] = [];
  const pipes: { id: number; start: number; end: number }[] = [];
  const otherLinks: { id: number; start: number; end: number }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = idMapper.getOrAssignIdx(id);

    if (asset.isLink) {
      const [startId, endId] = (asset as Pipe).connections;
      const start = idMapper.getOrAssignIdx(startId);
      const end = idMapper.getOrAssignIdx(endId);

      if (asset.type === "pipe") {
        pipes.push({ id: idx, start, end });
      } else {
        otherLinks.push({ id: idx, start, end });
      }
    } else {
      nodes.push({ id: idx });
    }
  }

  return {
    nodeBuffer: encodeNodesBuffer(nodes, bufferType),
    pipeBuffer: encodeLinksBuffer(pipes, bufferType),
    otherLinkBuffer: encodeLinksBuffer(otherLinks, bufferType),
    idsLookup: idMapper.getIdsLookup(),
  };
}

function encodeNodesBuffer(
  nodes: { id: number }[],
  bufferType: BufferType,
): BinaryData {
  const recordSize = NODE_BINARY_SIZE;
  const totalSize = BUFFER_HEADER_SIZE + nodes.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);

  const view = new DataView(buffer);
  encodeCount(view, nodes.length);
  nodes.forEach((n, i) => {
    const offset = BUFFER_HEADER_SIZE + i * recordSize;
    encodeNodeId(offset, view, n.id);
  });
  return buffer;
}

function encodeLinksBuffer(
  links: { id: number; start: number; end: number }[],
  bufferType: BufferType,
): BinaryData {
  const recordSize = LINK_BINARY_SIZE;
  const totalSize = BUFFER_HEADER_SIZE + links.length * recordSize;
  const buffer = createBuffer(totalSize, bufferType);

  const view = new DataView(buffer);
  encodeCount(view, links.length);
  links.forEach((l, i) => {
    const offset = BUFFER_HEADER_SIZE + i * recordSize;
    encodeLink(offset, view, l.id, l.start, l.end);
  });
  return buffer;
}

enum typeOrder {
  "reservoir" = 5,
  "tank" = 4,
  "valve" = 3,
  "pump" = 2,
  "junction" = 1,
  "pipe" = 0,
}

export function decodeOrphanAssets(
  model: HydraulicModel,
  idsLookup: string[],
  encodedOrphanAssets: EncodedOrphanAssets,
): OrphanAsset[] {
  const orphanAssets: OrphanAsset[] = [];

  const { orphanNodes, orphanLinks } = encodedOrphanAssets;

  orphanLinks.forEach((linkIdx) => {
    const linkId = idsLookup[linkIdx];
    const linkAsset = model.assets.get(linkId);
    if (linkAsset) {
      orphanAssets.push({
        assetId: linkId,
        type: linkAsset.type,
        label: linkAsset.label,
      });
    }
  });

  orphanNodes.forEach((nodeIdx) => {
    const nodeId = idsLookup[nodeIdx];
    const nodeAsset = model.assets.get(nodeId);
    if (nodeAsset) {
      orphanAssets.push({
        assetId: nodeId,
        type: nodeAsset.type,
        label: nodeAsset.label,
      });
    }
  });

  return orphanAssets.sort((a: OrphanAsset, b: OrphanAsset) => {
    const labelA = a.label.toUpperCase();
    const labelB = b.label.toUpperCase();

    if (a.type !== b.type) {
      return typeOrder[a.type] > typeOrder[b.type] ? -1 : 1;
    }
    return labelA < labelB ? -1 : labelA > labelB ? 1 : 0;
  });
}

export interface Node {
  id: number;
}

export interface Link {
  id: number;
  startNode: number;
  endNode: number;
}

export class HydraulicModelBufferView {
  private nodeView: DataView;
  private pipeView: DataView;
  private otherLinkView: DataView;

  readonly nodeCount: number;
  readonly pipeCount: number;
  readonly otherLinkCount: number;

  constructor(
    public readonly nodeBuffer: BinaryData,
    public readonly pipeBuffer: BinaryData,
    public readonly otherLinkBuffer: BinaryData,
  ) {
    this.nodeView = new DataView(nodeBuffer);
    this.pipeView = new DataView(pipeBuffer);
    this.otherLinkView = new DataView(otherLinkBuffer);

    this.nodeCount = decodeCount(this.nodeView);
    this.pipeCount = decodeCount(this.pipeView);
    this.otherLinkCount = decodeCount(this.otherLinkView);
  }

  *nodes(): Generator<Node> {
    for (let i = 0; i < this.nodeCount; i++) {
      yield {
        id: decodeNodeId(
          BUFFER_HEADER_SIZE + i * NODE_BINARY_SIZE,
          this.nodeView,
        ),
      };
    }
  }

  *pipes(): Generator<Link> {
    for (let i = 0; i < this.pipeCount; i++) {
      yield decodeLink(
        BUFFER_HEADER_SIZE + i * LINK_BINARY_SIZE,
        this.pipeView,
      );
    }
  }

  *otherLinks(): Generator<Link> {
    for (let i = 0; i < this.otherLinkCount; i++) {
      yield decodeLink(
        BUFFER_HEADER_SIZE + i * LINK_BINARY_SIZE,
        this.otherLinkView,
      );
    }
  }
}
