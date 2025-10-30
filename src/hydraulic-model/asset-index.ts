import {
  BinaryData,
  BufferType,
  DataSize,
  encodeNumber,
  decodeNumber,
  FixedSizeBufferView,
  FixedSizeBufferBuilder,
} from "src/lib/buffers";
import { AssetId, InternalId } from "./asset-types/base-asset";

export class AssetIndex {
  private linkInternalIds: InternalId[] = [];
  private nodeInternalIds: InternalId[] = [];
  private linkBufferIndexMap: Map<InternalId, number> = new Map();
  private nodeBufferIndexMap: Map<InternalId, number> = new Map();
  private maxInternalId: number = -1;

  addLink(internalId: InternalId): void {
    if (internalId === 0) {
      throw new Error("InternalId cannot be 0");
    }
    const bufferIndex = this.linkInternalIds.length;
    this.linkInternalIds.push(internalId);
    this.linkBufferIndexMap.set(internalId, bufferIndex);
    this.maxInternalId = Math.max(this.maxInternalId, internalId);
  }

  addNode(internalId: InternalId): void {
    if (internalId === 0) {
      throw new Error("InternalId cannot be 0");
    }
    const bufferIndex = this.nodeInternalIds.length;
    this.nodeInternalIds.push(internalId);
    this.nodeBufferIndexMap.set(internalId, bufferIndex);
    this.maxInternalId = Math.max(this.maxInternalId, internalId);
  }

  static toAssetId(internalId: InternalId): AssetId {
    return String(internalId);
  }

  static toInternalId(assetId: AssetId): InternalId {
    return Number(assetId);
  }

  *iterateLinkInternalIds(): Generator<InternalId, void, unknown> {
    for (const internalId of this.linkInternalIds) {
      yield internalId;
    }
  }

  *iterateNodeInternalIds(): Generator<InternalId, void, unknown> {
    for (const internalId of this.nodeInternalIds) {
      yield internalId;
    }
  }

  get linkCount(): number {
    return this.linkInternalIds.length;
  }

  get nodeCount(): number {
    return this.nodeInternalIds.length;
  }

  getEncoder(bufferType: BufferType = "array"): AssetIndexEncoder {
    return new AssetIndexEncoder(
      this.linkBufferIndexMap,
      this.nodeBufferIndexMap,
      this.maxInternalId,
      bufferType,
    );
  }
}

const ASSET_TYPE_LINK = 0;
const ASSET_TYPE_NODE = 1;
const EMPTY_ASSET_INDEX = 0;
const ASSET_INDEX_SIZE = DataSize.number;
const ASSET_INDEX_BIT_ENCODING_MASK = 0x7fffffff;

type BufferIndex = number;

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

export class AssetIndexEncoder {
  private bufferBuilder: FixedSizeBufferBuilder<AssetIndexEntry>;

  constructor(
    private linkBufferIndexMap: Map<InternalId, number>,
    private nodeBufferIndexMap: Map<InternalId, number>,
    maxInternalId: number,
    bufferType: BufferType = "array",
  ) {
    this.bufferBuilder = new FixedSizeBufferBuilder<AssetIndexEntry>(
      ASSET_INDEX_SIZE,
      maxInternalId + 1,
      bufferType,
      encodeAssetIndex,
    );
  }

  encode(
    linkIds: () => Generator<InternalId, void, unknown>,
    nodeIds: () => Generator<InternalId, void, unknown>,
  ): BinaryData {
    for (const internalId of nodeIds()) {
      this.encodeNode(internalId);
    }
    for (const internalId of linkIds()) {
      this.encodeLink(internalId);
    }

    return this.finalize();
  }

  encodeLink(internalId: InternalId): void {
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

  encodeNode(internalId: InternalId): void {
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

  constructor(buffer: BinaryData) {
    this.view = new FixedSizeBufferView(
      buffer,
      ASSET_INDEX_SIZE,
      decodeAssetIndex,
    );
  }

  getLinkIndex(internalId: InternalId): number | null {
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

  getNodeIndex(internalId: InternalId): number | null {
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

  hasLink(internalId: InternalId): boolean {
    return this.getLinkIndex(internalId) !== null;
  }

  hasNode(internalId: InternalId): boolean {
    return this.getNodeIndex(internalId) !== null;
  }

  get count(): number {
    return this.view.count;
  }
}
