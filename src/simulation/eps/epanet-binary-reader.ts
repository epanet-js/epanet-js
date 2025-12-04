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

export type TimestepResults = {
  timestepIndex: number;
  nodes: NodeTimestepResult[];
  links: LinkTimestepResult[];
};

const ID_STRING_LENGTH = 32;
const PROLOG_OFFSET = 884;

/**
 * Parses the prolog section of the EPANET binary file.
 * This is needed to calculate offsets for data access.
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
 * Calculates the byte offset where the results section starts.
 */
function calculateResultsBaseOffset(prolog: EpanetProlog): number {
  // After prolog, node IDs, link IDs, and additional metadata
  const nodeIdsSize = ID_STRING_LENGTH * prolog.nodeCount;
  const linkIdsSize = ID_STRING_LENGTH * prolog.linkCount;

  // Additional sections before results:
  // - Link types: 4 bytes × linkCount
  // - Tank node indices: 4 bytes × resAndTankCount
  // - Tank areas: 4 bytes × resAndTankCount
  // - Energy usage headers: varies by pump count
  const linkTypesSize = 4 * prolog.linkCount;
  const tankIndicesSize = 4 * prolog.resAndTankCount;
  const tankAreasSize = 4 * prolog.resAndTankCount;
  const energyHeaderSize = 28 * prolog.pumpCount + 4; // 28 bytes per pump + 4 for peak energy

  return (
    PROLOG_OFFSET +
    nodeIdsSize +
    linkIdsSize +
    linkTypesSize +
    tankIndicesSize +
    tankAreasSize +
    energyHeaderSize
  );
}

/**
 * Calculates the size in bytes of one timestep's results.
 */
function calculateTimestepBlockSize(prolog: EpanetProlog): number {
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
 * Parse a null-terminated ID string from bytes.
 */
function parseIdString(bytes: Uint8Array): string {
  const nonNullBytes = Array.from(bytes).filter((b) => b > 0);
  return String.fromCharCode.apply(null, nonNullBytes);
}

/**
 * High-level reader that caches prolog and IDs for efficient repeated access.
 */
export class EpanetBinaryReader {
  private data: Uint8Array;
  private prolog: EpanetProlog;
  private nodeIds: string[];
  private linkIds: string[];

  constructor(data: Uint8Array) {
    this.data = data;
    this.prolog = parseProlog(data);
    this.nodeIds = extractNodeIds(data, this.prolog);
    this.linkIds = extractLinkIds(data, this.prolog);
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
