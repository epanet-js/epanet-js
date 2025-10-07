import { Pipe, AssetType, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";

export type BinaryData = ArrayBuffer | SharedArrayBuffer;

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
}

const UINT32_SIZE = 4;
const BUFFER_HEADER_SIZE = UINT32_SIZE;
const NODE_BINARY_SIZE = UINT32_SIZE;
const LINK_BINARY_SIZE = UINT32_SIZE * 3;

export function encodeHydraulicModel(
  model: HydraulicModel,
  bufferType: "shared" | "array" = "array",
): EncodedHydraulicModel {
  const idsLookup: string[] = [];
  const idxLookup = new Map<string, number>(); // string ID → numeric index

  const getOrAssignIdx = (id: string) => {
    let idx = idxLookup.get(id);
    if (idx === undefined) {
      idx = idsLookup.length;
      idxLookup.set(id, idx);
      idsLookup.push(id);
    }
    return idx;
  };

  const nodes: { id: number }[] = [];
  const pipes: { id: number; start: number; end: number }[] = [];
  const otherLinks: { id: number; start: number; end: number }[] = [];

  for (const [id, asset] of model.assets) {
    const idx = getOrAssignIdx(id);

    if (asset.isLink) {
      const [startId, endId] = (asset as Pipe).connections;
      const start = getOrAssignIdx(startId);
      const end = getOrAssignIdx(endId);

      if (asset.type === "pipe") {
        pipes.push({ id: idx, start, end });
      } else {
        otherLinks.push({ id: idx, start, end });
      }
    } else {
      nodes.push({ id: idx });
    }
  }

  function encodeNodes(nodes: { id: number }[]): BinaryData {
    const recordSize = NODE_BINARY_SIZE;
    const totalSize = BUFFER_HEADER_SIZE + nodes.length * recordSize;
    const buffer =
      bufferType === "shared"
        ? new SharedArrayBuffer(totalSize)
        : new ArrayBuffer(totalSize);

    const view = new DataView(buffer);
    view.setUint32(0, nodes.length, true);
    nodes.forEach((n, i) => {
      const offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, n.id, true);
    });
    return buffer;
  }

  function encodeLinks(
    links: { id: number; start: number; end: number }[],
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
      let offset = UINT32_SIZE + i * recordSize;
      view.setUint32(offset, l.id, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, l.start, true);
      offset += UINT32_SIZE;
      view.setUint32(offset, l.end, true);
    });
    return buffer;
  }

  return {
    nodeBuffer: encodeNodes(nodes),
    pipeBuffer: encodeLinks(pipes),
    otherLinkBuffer: encodeLinks(otherLinks),
    idsLookup: idsLookup,
  };
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
      orphanAssets.push({ assetId: linkId, type: linkAsset.type });
    }
  });

  orphanNodes.forEach((nodeIdx) => {
    const nodeId = idsLookup[nodeIdx];
    const nodeAsset = model.assets.get(nodeId);
    if (nodeAsset) {
      orphanAssets.push({ assetId: nodeId, type: nodeAsset.type });
    }
  });

  return orphanAssets.sort((a: OrphanAsset, b: OrphanAsset) => {
    const nameA = a.assetId.toUpperCase();
    const nameB = b.assetId.toUpperCase();

    if (a.type !== b.type) {
      return typeOrder[a.type] > typeOrder[b.type] ? -1 : 1;
    }
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
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

    this.nodeCount = this.decodeCount(this.nodeView);
    this.pipeCount = this.decodeCount(this.pipeView);
    this.otherLinkCount = this.decodeCount(this.otherLinkView);
  }

  *nodes(): Generator<Node> {
    for (let i = 0; i < this.nodeCount; i++) {
      yield this.decodeNode(this.nodeView, i);
    }
  }

  *pipes(): Generator<Link> {
    for (let i = 0; i < this.pipeCount; i++) {
      yield this.decodeLink(this.pipeView, i);
    }
  }

  *otherLinks(): Generator<Link> {
    for (let i = 0; i < this.otherLinkCount; i++) {
      yield this.decodeLink(this.otherLinkView, i);
    }
  }

  private decodeCount(view: DataView): number {
    return view.getUint32(0, true);
  }

  private decodeNode(view: DataView, index: number): Node {
    const id = view.getUint32(
      BUFFER_HEADER_SIZE + index * NODE_BINARY_SIZE,
      true,
    );
    return { id };
  }

  private decodeLink(view: DataView, index: number): Link {
    let offset = BUFFER_HEADER_SIZE + index * LINK_BINARY_SIZE;
    const id = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const startNode = view.getUint32(offset, true);
    offset += UINT32_SIZE;
    const endNode = view.getUint32(offset, true);
    return {
      id,
      startNode,
      endNode,
    };
  }
}
