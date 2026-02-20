import { AssetId } from "src/hydraulic-model/asset-types";
import { EncodedTraceResult } from "./types";

export function decodeTraceResult(
  result: EncodedTraceResult,
  nodeIdsLookup: number[],
  linkIdsLookup: number[],
): AssetId[] {
  const ids: AssetId[] = [];

  for (const nodeIdx of result.nodeIndices) {
    ids.push(nodeIdsLookup[nodeIdx]);
  }

  for (const linkIdx of result.linkIndices) {
    ids.push(linkIdsLookup[linkIdx]);
  }

  return ids;
}
