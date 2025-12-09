/**
 * EPANET Binary Output File Reader
 *
 * Reads EPANET's native binary output format (results.out) and extracts
 * results for specific timesteps without parsing the entire file.
 *
 * Binary Format Structure:
 * - Prolog (bytes 0-883): Fixed header with counts
 * - ID Section (byte 884+): Asset IDs as 32-byte strings
 * - Results Section: Repeating timestep blocks
 * - Epilog (last 12 bytes): Reporting periods count
 *
 * Each timestep block contains:
 * - Node data: 4 floats × nodeCount (demand, head, pressure, waterQuality)
 * - Link data: 8 floats × linkCount (flow, velocity, headloss, avgWQ, status, setting, reactionRate, friction)
 */

export type EpanetProlog = {
  nodeCount: number;
  resAndTankCount: number;
  linkCount: number;
  pumpCount: number;
  valveCount: number;
  reportingPeriods: number;
};

export type NodeTimestepResult = {
  id: string;
  demand: number;
  head: number;
  pressure: number;
  waterQuality: number;
};

export type LinkTimestepResult = {
  id: string;
  flow: number;
  velocity: number;
  headloss: number;
  avgWaterQuality: number;
  status: number;
  setting: number;
  reactionRate: number;
  friction: number;
};

/**
 * EPANET link type codes stored in binary output.
 * These match the LinkType enum in epanet-js.
 */
export enum BinaryLinkType {
  CVPipe = 0,
  Pipe = 1,
  Pump = 2,
  PRV = 3,
  PSV = 4,
  PBV = 5,
  FCV = 6,
  TCV = 7,
  GPV = 8,
}

export type TimestepResults = {
  timestepIndex: number;
  nodes: NodeTimestepResult[];
  links: LinkTimestepResult[];
};

const ID_STRING_LENGTH = 32;
const PROLOG_OFFSET = 884;

/**
 * Size of the fixed prolog header (before variable-length sections).
 * This contains counts and configuration values.
 */
export const PROLOG_HEADER_SIZE = 884;

/**
 * Parses the prolog section of the EPANET binary file.
 * This is needed to calculate offsets for data access.
 *
 * Note: reportingPeriods is read from the epilog (last 12 bytes of file).
 * For partial reads, use parsePrologHeader and provide reportingPeriods separately.
 */
export function parseProlog(data: Uint8Array): EpanetProlog {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  return {
    nodeCount: view.getInt32(8, true),
    resAndTankCount: view.getInt32(12, true),
    linkCount: view.getInt32(16, true),
    pumpCount: view.getInt32(20, true),
    valveCount: view.getInt32(24, true),
    reportingPeriods: view.getInt32(data.byteLength - 12, true),
  };
}

/**
 * Parses just the prolog header (first 884 bytes) without needing the full file.
 * Use this for partial reads where reportingPeriods comes from metadata.
 */
export function parsePrologHeader(
  headerData: Uint8Array,
  reportingPeriods: number,
): EpanetProlog {
  const view = new DataView(
    headerData.buffer,
    headerData.byteOffset,
    headerData.byteLength,
  );

  return {
    nodeCount: view.getInt32(8, true),
    resAndTankCount: view.getInt32(12, true),
    linkCount: view.getInt32(16, true),
    pumpCount: view.getInt32(20, true),
    valveCount: view.getInt32(24, true),
    reportingPeriods,
  };
}

/**
 * Calculates the size of the entire prolog section (all metadata before results).
 * This is the amount of data needed to extract IDs, types, and tank info.
 */
export function calculatePrologSize(prolog: EpanetProlog): number {
  return calculateResultsBaseOffset(prolog);
}

/**
 * Extracts node IDs from the binary file.
 */
export function extractNodeIds(
  data: Uint8Array,
  prolog: EpanetProlog,
): string[] {
  const ids: string[] = [];
  const startOffset = PROLOG_OFFSET;

  for (let i = 0; i < prolog.nodeCount; i++) {
    const offset = startOffset + ID_STRING_LENGTH * i;
    const idBytes = data.slice(offset, offset + ID_STRING_LENGTH);
    ids.push(parseIdString(idBytes));
  }

  return ids;
}

/**
 * Extracts link IDs from the binary file.
 */
export function extractLinkIds(
  data: Uint8Array,
  prolog: EpanetProlog,
): string[] {
  const ids: string[] = [];
  const startOffset = PROLOG_OFFSET + ID_STRING_LENGTH * prolog.nodeCount;

  for (let i = 0; i < prolog.linkCount; i++) {
    const offset = startOffset + ID_STRING_LENGTH * i;
    const idBytes = data.slice(offset, offset + ID_STRING_LENGTH);
    ids.push(parseIdString(idBytes));
  }

  return ids;
}

/**
 * Extracts link types from the binary file.
 * Link types are stored after: prolog, node IDs, link IDs, link start/end indices.
 */
export function extractLinkTypes(
  data: Uint8Array,
  prolog: EpanetProlog,
): BinaryLinkType[] {
  const types: BinaryLinkType[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Offset: prolog + nodeIds + linkIds + linkStartIndices + linkEndIndices
  const startOffset =
    PROLOG_OFFSET +
    ID_STRING_LENGTH * prolog.nodeCount +
    ID_STRING_LENGTH * prolog.linkCount +
    4 * prolog.linkCount + // link start node indices
    4 * prolog.linkCount; // link end node indices

  for (let i = 0; i < prolog.linkCount; i++) {
    const offset = startOffset + 4 * i;
    types.push(view.getInt32(offset, true) as BinaryLinkType);
  }

  return types;
}

/**
 * Extracts tank/reservoir node indices from the binary file.
 * Returns 0-based indices into the node array that identify tanks and reservoirs.
 */
export function extractTankIndices(
  data: Uint8Array,
  prolog: EpanetProlog,
): number[] {
  const indices: number[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Offset: prolog + nodeIds + linkIds + linkStartIndices + linkEndIndices + linkTypes
  const startOffset =
    PROLOG_OFFSET +
    ID_STRING_LENGTH * prolog.nodeCount +
    ID_STRING_LENGTH * prolog.linkCount +
    4 * prolog.linkCount + // link start node indices
    4 * prolog.linkCount + // link end node indices
    4 * prolog.linkCount; // link types

  for (let i = 0; i < prolog.resAndTankCount; i++) {
    const offset = startOffset + 4 * i;
    // Binary stores 1-based indices, convert to 0-based
    indices.push(view.getInt32(offset, true) - 1);
  }

  return indices;
}

/**
 * Extracts tank cross-sectional areas from the binary file.
 * Reservoirs have area = 0, tanks have area > 0.
 */
export function extractTankAreas(
  data: Uint8Array,
  prolog: EpanetProlog,
): number[] {
  const areas: number[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Offset: same as tank indices base + tank indices size
  const tankIndicesOffset =
    PROLOG_OFFSET +
    ID_STRING_LENGTH * prolog.nodeCount +
    ID_STRING_LENGTH * prolog.linkCount +
    4 * prolog.linkCount + // link start node indices
    4 * prolog.linkCount + // link end node indices
    4 * prolog.linkCount; // link types
  const areasOffset = tankIndicesOffset + 4 * prolog.resAndTankCount;

  for (let i = 0; i < prolog.resAndTankCount; i++) {
    const offset = areasOffset + 4 * i;
    areas.push(view.getFloat32(offset, true));
  }

  return areas;
}

/**
 * Calculates the byte offset where the results section starts.
 *
 * The prolog section contains:
 * - 884 bytes of fixed header data
 * - 36 bytes per node (32 byte ID + 4 byte elevation)
 * - 52 bytes per link (32 byte ID + 8 byte indices + 4 byte type + 8 byte length/diameter)
 * - 8 bytes per tank (4 byte index + 4 byte area)
 * - 28 bytes per pump (energy data) + 4 bytes (peak energy)
 */
export function calculateResultsBaseOffset(prolog: EpanetProlog): number {
  return (
    PROLOG_OFFSET +
    36 * prolog.nodeCount +
    52 * prolog.linkCount +
    8 * prolog.resAndTankCount +
    28 * prolog.pumpCount +
    4
  );
}

/**
 * Calculates the size in bytes of one timestep's results.
 */
export function calculateTimestepBlockSize(prolog: EpanetProlog): number {
  // Node results: 4 floats (demand, head, pressure, waterQuality) × nodeCount
  const nodeResultsSize = 16 * prolog.nodeCount;
  // Link results: 8 floats × linkCount
  const linkResultsSize = 32 * prolog.linkCount;
  return nodeResultsSize + linkResultsSize;
}

/**
 * Extracts results for a specific timestep from the binary data.
 */
export function extractTimestepResults(
  data: Uint8Array,
  prolog: EpanetProlog,
  timestepIndex: number,
  nodeIds: string[],
  linkIds: string[],
): TimestepResults {
  if (timestepIndex < 0 || timestepIndex >= prolog.reportingPeriods) {
    throw new Error(
      `Timestep index ${timestepIndex} out of range [0, ${prolog.reportingPeriods - 1}]`,
    );
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const baseOffset = calculateResultsBaseOffset(prolog);
  const blockSize = calculateTimestepBlockSize(prolog);
  const timestepOffset = baseOffset + blockSize * timestepIndex;

  // Extract node results
  const nodes: NodeTimestepResult[] = [];
  for (let i = 0; i < prolog.nodeCount; i++) {
    // Node data layout: demand, head, pressure, waterQuality (4 floats per node)
    // But they're stored as: all demands, then all heads, then all pressures, etc.
    const demandOffset = timestepOffset + 4 * i;
    const headOffset = timestepOffset + 4 * prolog.nodeCount + 4 * i;
    const pressureOffset = timestepOffset + 8 * prolog.nodeCount + 4 * i;
    const waterQualityOffset = timestepOffset + 12 * prolog.nodeCount + 4 * i;

    nodes.push({
      id: nodeIds[i],
      demand: view.getFloat32(demandOffset, true),
      head: view.getFloat32(headOffset, true),
      pressure: view.getFloat32(pressureOffset, true),
      waterQuality: view.getFloat32(waterQualityOffset, true),
    });
  }

  // Extract link results
  const links: LinkTimestepResult[] = [];
  const linkResultsOffset = timestepOffset + 16 * prolog.nodeCount;
  for (let i = 0; i < prolog.linkCount; i++) {
    // Link data layout: all flows, then all velocities, etc.
    const flowOffset = linkResultsOffset + 4 * i;
    const velocityOffset = linkResultsOffset + 4 * prolog.linkCount + 4 * i;
    const headlossOffset = linkResultsOffset + 8 * prolog.linkCount + 4 * i;
    const avgWQOffset = linkResultsOffset + 12 * prolog.linkCount + 4 * i;
    const statusOffset = linkResultsOffset + 16 * prolog.linkCount + 4 * i;
    const settingOffset = linkResultsOffset + 20 * prolog.linkCount + 4 * i;
    const reactionRateOffset =
      linkResultsOffset + 24 * prolog.linkCount + 4 * i;
    const frictionOffset = linkResultsOffset + 28 * prolog.linkCount + 4 * i;

    links.push({
      id: linkIds[i],
      flow: view.getFloat32(flowOffset, true),
      velocity: view.getFloat32(velocityOffset, true),
      headloss: view.getFloat32(headlossOffset, true),
      avgWaterQuality: view.getFloat32(avgWQOffset, true),
      status: view.getFloat32(statusOffset, true),
      setting: view.getFloat32(settingOffset, true),
      reactionRate: view.getFloat32(reactionRateOffset, true),
      friction: view.getFloat32(frictionOffset, true),
    });
  }

  return {
    timestepIndex,
    nodes,
    links,
  };
}

/**
 * Extracts results from a timestep data slice (for partial reading from OPFS).
 *
 * The slice should contain exactly one timestep block of data.
 * Use calculateTimestepBlockSize() to determine the required slice size.
 *
 * @param slice - Uint8Array containing one timestep block
 * @param prolog - Prolog data for calculating offsets
 * @param timestepIndex - The timestep index (for the result object)
 * @param nodeIds - Array of node IDs
 * @param linkIds - Array of link IDs
 */
export function extractTimestepFromSlice(
  slice: Uint8Array,
  prolog: EpanetProlog,
  timestepIndex: number,
  nodeIds: string[],
  linkIds: string[],
): TimestepResults {
  const view = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);

  // Extract node results (data starts at offset 0 in the slice)
  const nodes: NodeTimestepResult[] = [];
  for (let i = 0; i < prolog.nodeCount; i++) {
    const demandOffset = 4 * i;
    const headOffset = 4 * prolog.nodeCount + 4 * i;
    const pressureOffset = 8 * prolog.nodeCount + 4 * i;
    const waterQualityOffset = 12 * prolog.nodeCount + 4 * i;

    nodes.push({
      id: nodeIds[i],
      demand: view.getFloat32(demandOffset, true),
      head: view.getFloat32(headOffset, true),
      pressure: view.getFloat32(pressureOffset, true),
      waterQuality: view.getFloat32(waterQualityOffset, true),
    });
  }

  // Extract link results
  const links: LinkTimestepResult[] = [];
  const linkResultsOffset = 16 * prolog.nodeCount;
  for (let i = 0; i < prolog.linkCount; i++) {
    const flowOffset = linkResultsOffset + 4 * i;
    const velocityOffset = linkResultsOffset + 4 * prolog.linkCount + 4 * i;
    const headlossOffset = linkResultsOffset + 8 * prolog.linkCount + 4 * i;
    const avgWQOffset = linkResultsOffset + 12 * prolog.linkCount + 4 * i;
    const statusOffset = linkResultsOffset + 16 * prolog.linkCount + 4 * i;
    const settingOffset = linkResultsOffset + 20 * prolog.linkCount + 4 * i;
    const reactionRateOffset =
      linkResultsOffset + 24 * prolog.linkCount + 4 * i;
    const frictionOffset = linkResultsOffset + 28 * prolog.linkCount + 4 * i;

    links.push({
      id: linkIds[i],
      flow: view.getFloat32(flowOffset, true),
      velocity: view.getFloat32(velocityOffset, true),
      headloss: view.getFloat32(headlossOffset, true),
      avgWaterQuality: view.getFloat32(avgWQOffset, true),
      status: view.getFloat32(statusOffset, true),
      setting: view.getFloat32(settingOffset, true),
      reactionRate: view.getFloat32(reactionRateOffset, true),
      friction: view.getFloat32(frictionOffset, true),
    });
  }

  return {
    timestepIndex,
    nodes,
    links,
  };
}

/**
 * Parse a null-terminated ID string from bytes.
 */
function parseIdString(bytes: Uint8Array): string {
  const nonNullBytes = Array.from(bytes).filter((b) => b > 0);
  return String.fromCharCode.apply(null, nonNullBytes);
}

/**
 * Node type as determined from binary file (similar to epanet-js NodeType enum).
 * Note: The binary file doesn't store node types explicitly.
 * Tanks/reservoirs are identified by tank indices, and reservoirs are
 * distinguished from tanks by having cross-sectional area = 0.
 */
export enum BinaryNodeType {
  Junction = 0,
  Reservoir = 1,
  Tank = 2,
}

/**
 * Builds node types array from tank indices and areas.
 * Reservoirs are distinguished from tanks by having area = 0.
 */
export function buildNodeTypes(
  nodeCount: number,
  tankIndices: number[],
  tankAreas: number[],
): BinaryNodeType[] {
  const types: BinaryNodeType[] = new Array(nodeCount).fill(
    BinaryNodeType.Junction,
  );

  for (let i = 0; i < tankIndices.length; i++) {
    const nodeIndex = tankIndices[i];
    if (tankAreas[i] === 0) {
      types[nodeIndex] = BinaryNodeType.Reservoir;
    } else {
      types[nodeIndex] = BinaryNodeType.Tank;
    }
  }

  return types;
}

/**
 * High-level reader that caches prolog and IDs for efficient repeated access.
 */
export class EpanetBinaryReader {
  private data: Uint8Array;
  private prolog: EpanetProlog;
  private nodeIds: string[];
  private linkIds: string[];
  private linkTypes: BinaryLinkType[];
  private nodeTypes: BinaryNodeType[];

  constructor(data: Uint8Array) {
    this.data = data;
    this.prolog = parseProlog(data);
    this.nodeIds = extractNodeIds(data, this.prolog);
    this.linkIds = extractLinkIds(data, this.prolog);
    this.linkTypes = extractLinkTypes(data, this.prolog);

    // Build node types array from tank indices and areas
    const tankIndices = extractTankIndices(data, this.prolog);
    const tankAreas = extractTankAreas(data, this.prolog);
    this.nodeTypes = buildNodeTypes(
      this.prolog.nodeCount,
      tankIndices,
      tankAreas,
    );
  }

  getProlog(): EpanetProlog {
    return this.prolog;
  }

  getTimestepCount(): number {
    return this.prolog.reportingPeriods;
  }

  getNodeIds(): string[] {
    return this.nodeIds;
  }

  getLinkIds(): string[] {
    return this.linkIds;
  }

  getLinkTypes(): BinaryLinkType[] {
    return this.linkTypes;
  }

  getNodeTypes(): BinaryNodeType[] {
    return this.nodeTypes;
  }

  /**
   * Get the node type for a specific node.
   * @param nodeIndex 0-based index into the node array
   */
  getNodeType(nodeIndex: number): BinaryNodeType {
    return this.nodeTypes[nodeIndex];
  }

  /**
   * Check if a node is a tank or reservoir (vs junction).
   * @param nodeIndex 0-based index into the node array
   */
  isTankOrReservoir(nodeIndex: number): boolean {
    return (
      this.nodeTypes[nodeIndex] === BinaryNodeType.Tank ||
      this.nodeTypes[nodeIndex] === BinaryNodeType.Reservoir
    );
  }

  getTimestepResults(timestepIndex: number): TimestepResults {
    return extractTimestepResults(
      this.data,
      this.prolog,
      timestepIndex,
      this.nodeIds,
      this.linkIds,
    );
  }
}
