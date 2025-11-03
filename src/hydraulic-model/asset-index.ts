import {
  BinaryData,
  BufferType,
  DataSize,
  encodeNumber,
  decodeNumber,
  FixedSizeBufferView,
  FixedSizeBufferBuilder,
} from "src/lib/buffers";
import { AssetId } from "./asset-types/base-asset";

export class AssetIndex {
  private linkAssetIds: AssetId[] = [];
  private nodeAssetIds: AssetId[] = [];
  private linkBufferIndexMap: Map<AssetId, number> = new Map();
  private nodeBufferIndexMap: Map<AssetId, number> = new Map();
  private maxAssetId: number = -1;

  addLink(internalId: AssetId): void {
    if (internalId === 0) {
      throw new Error("AssetId cannot be 0");
    }
    const bufferIndex = this.linkAssetIds.length;
    this.linkAssetIds.push(internalId);
    this.linkBufferIndexMap.set(internalId, bufferIndex);
    this.maxAssetId = Math.max(this.maxAssetId, internalId);
  }

  addNode(internalId: AssetId): void {
    if (internalId === 0) {
      throw new Error("AssetId cannot be 0");
    }
    const bufferIndex = this.nodeAssetIds.length;
    this.nodeAssetIds.push(internalId);
    this.nodeBufferIndexMap.set(internalId, bufferIndex);
    this.maxAssetId = Math.max(this.maxAssetId, internalId);
  }

  *iterateLinkAssetIds(): Generator<AssetId, void, unknown> {
    for (const internalId of this.linkAssetIds) {
      yield internalId;
    }
  }

  *iterateNodeAssetIds(): Generator<AssetId, void, unknown> {
    for (const internalId of this.nodeAssetIds) {
      yield internalId;
    }
  }

  get linkCount(): number {
    return this.linkAssetIds.length;
  }

  get nodeCount(): number {
    return this.nodeAssetIds.length;
  }

  getEncoder(bufferType: BufferType = "array"): AssetIndexEncoder {
    return new AssetIndexEncoder(
      this.linkBufferIndexMap,
      this.nodeBufferIndexMap,
      this.linkCount,
      this.nodeCount,
      this.maxAssetId,
      bufferType,
    );
  }
}

const ASSET_TYPE_LINK = 0;
const ASSET_TYPE_NODE = 1;
const EMPTY_ASSET_INDEX = 0;
const ASSET_INDEX_SIZE = DataSize.number;
const ASSET_INDEX_BIT_ENCODING_MASK = 0x7fffffff;
const ASSET_INDEX_CUSTOM_HEADER_SIZE = DataSize.number * 2; // linkCount + nodeCount

type BufferIndex = number;
type LinkIndex = number;
type NodeIndex = number;

type AssetIndexEntry = [
  typeof ASSET_TYPE_LINK | typeof ASSET_TYPE_NODE,
  BufferIndex,
];

function encodeAssetIndex(
  [type, index]: AssetIndexEntry,
  offset: number,
  view: DataView,
) {
  const bitEncodedValue =
    (type << 31) | (index & ASSET_INDEX_BIT_ENCODING_MASK);
  encodeNumber(bitEncodedValue, offset, view);
}

function decodeAssetIndex(
  offset: number,
  view: DataView,
): AssetIndexEntry | null {
  const bitEncodedValue = decodeNumber(offset, view);
  if (bitEncodedValue === EMPTY_ASSET_INDEX) return null;

  const type = ((bitEncodedValue >>> 31) & 1) as 0 | 1;
  const index = bitEncodedValue & ASSET_INDEX_BIT_ENCODING_MASK;
  return [type, index];
}

function decodeHeader(offset: number, view: DataView) {
  const linkCount = decodeNumber(offset, view);
  const nodeCount = decodeNumber(offset + DataSize.number, view);

  return { linkCount, nodeCount };
}

function encodeHeader(
  linkCount: number,
  nodeCount: number,
  offset: number,
  view: DataView,
) {
  encodeNumber(linkCount, offset, view);
  encodeNumber(nodeCount, offset + DataSize.number, view);
}

export class AssetIndexEncoder {
  private bufferBuilder: FixedSizeBufferBuilder<AssetIndexEntry>;

  constructor(
    private linkBufferIndexMap: Map<AssetId, number>,
    private nodeBufferIndexMap: Map<AssetId, number>,
    private linkCount: number,
    private nodeCount: number,
    maxAssetId: number,
    bufferType: BufferType = "array",
  ) {
    this.bufferBuilder = new FixedSizeBufferBuilder<AssetIndexEntry>(
      ASSET_INDEX_SIZE,
      maxAssetId + 1,
      bufferType,
      encodeAssetIndex,
      ASSET_INDEX_CUSTOM_HEADER_SIZE,
      (offset, view) => encodeHeader(linkCount, nodeCount, offset, view),
    );
  }

  encode(
    linkIds: () => Generator<AssetId, void, unknown>,
    nodeIds: () => Generator<AssetId, void, unknown>,
  ): BinaryData {
    for (const internalId of nodeIds()) {
      this.encodeNode(internalId);
    }
    for (const internalId of linkIds()) {
      this.encodeLink(internalId);
    }

    return this.finalize();
  }

  encodeLink(internalId: AssetId): void {
    const bufferIndex = this.linkBufferIndexMap.get(internalId);
    if (bufferIndex === undefined) {
      throw new Error(`Link with internalId ${internalId} not found`);
    }

    // Add 1 to bufferIndex to ensure encoded value is never 0 (EMPTY_ASSET_INDEX)
    // This is necessary because the first asset gets bufferIndex=0, and
    // encodeAssetIndex(ASSET_TYPE_LINK=0, 0) = 0, which would be indistinguishable from empty
    this.bufferBuilder.addAtIndex(internalId, [
      ASSET_TYPE_LINK,
      bufferIndex + 1,
    ]);
  }

  encodeNode(internalId: AssetId): void {
    const bufferIndex = this.nodeBufferIndexMap.get(internalId);
    if (bufferIndex === undefined) {
      throw new Error(`Node with internalId ${internalId} not found`);
    }

    // Add 1 to bufferIndex to ensure consistency on link and node indexes
    this.bufferBuilder.addAtIndex(internalId, [
      ASSET_TYPE_NODE,
      bufferIndex + 1,
    ]);
  }

  finalize(): BinaryData {
    if (!this.bufferBuilder) {
      throw new Error("prepareEncoding must be called before finalize");
    }
    return this.bufferBuilder?.finalize();
  }
}

export class AssetIndexView {
  private view: FixedSizeBufferView<AssetIndexEntry | null>;
  private linkCountValue: number = 0;
  private nodeCountValue: number = 0;

  constructor(buffer: BinaryData) {
    this.view = new FixedSizeBufferView(
      buffer,
      ASSET_INDEX_SIZE,
      decodeAssetIndex,
      ASSET_INDEX_CUSTOM_HEADER_SIZE,
      (offset: number, view: DataView) => {
        const { linkCount, nodeCount } = decodeHeader(offset, view);
        this.linkCountValue = linkCount;
        this.nodeCountValue = nodeCount;
      },
    );
  }

  getLinkIndex(internalId: AssetId): LinkIndex | null {
    if (internalId < 0 || internalId >= this.view.count) {
      return null;
    }
    const assetIndex = this.view.getById(internalId);
    if (assetIndex === null) return null;
    const [type, index] = assetIndex;
    if (type !== ASSET_TYPE_LINK) {
      return null;
    }
    // Subtract 1 because we added 1 during encoding to avoid 0 collision
    return index - 1;
  }

  getNodeIndex(internalId: AssetId): NodeIndex | null {
    if (internalId < 0 || internalId >= this.view.count) {
      return null;
    }
    const assetIndex = this.view.getById(internalId);
    if (assetIndex === null) return null;
    const [type, index] = assetIndex;
    if (type !== ASSET_TYPE_NODE) {
      return null;
    }
    // Subtract 1 because we added 1 during encoding to avoid 0 collision
    return index - 1;
  }

  hasLink(internalId: AssetId): boolean {
    return this.getLinkIndex(internalId) !== null;
  }

  hasNode(internalId: AssetId): boolean {
    return this.getNodeIndex(internalId) !== null;
  }

  *iterateLinks(): Generator<[AssetId, LinkIndex], void, unknown> {
    for (const [internalId, assetIndexEntry] of this.view.enumerate()) {
      if (assetIndexEntry === null) continue;
      const [type, encodedIndex] = assetIndexEntry;
      if (type === ASSET_TYPE_LINK) {
        yield [internalId, encodedIndex - 1];
      }
    }
  }

  *iterateNodes(): Generator<[AssetId, NodeIndex], void, unknown> {
    for (const [internalId, assetIndexEntry] of this.view.enumerate()) {
      if (assetIndexEntry === null) continue;
      const [type, encodedIndex] = assetIndexEntry;
      if (type === ASSET_TYPE_NODE) {
        yield [internalId, encodedIndex - 1];
      }
    }
  }

  get linkCount(): number {
    return this.linkCountValue;
  }

  get nodeCount(): number {
    return this.nodeCountValue;
  }

  get count(): number {
    return this.view.count;
  }
}
