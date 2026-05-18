import { nanoid } from "nanoid";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { ResultsReader } from "src/simulation/results-reader";
import { HglProfile } from "src/state/hgl-profile";
import { deriveProfilePath } from "./path-finding";

export type BuildHglProfileArgs = {
  anchorIds: AssetId[];
  hydraulicModel: HydraulicModel;
  isUnprojected: boolean;
  results?: ResultsReader | null;
};

export type BuildHglProfileResult =
  | { hglProfile: HglProfile; path: PathData }
  | { error: "noPath" };

export function buildHglProfile({
  anchorIds,
  hydraulicModel,
  isUnprojected,
  results = null,
}: BuildHglProfileArgs): BuildHglProfileResult {
  const path = deriveProfilePath(
    hydraulicModel.topology,
    hydraulicModel.assets,
    anchorIds,
    results,
  );

  if (path === null) {
    return { error: "noPath" };
  }

  return {
    hglProfile: {
      id: nanoid(),
      anchors: path.nodeIds,
      terrain: null,
      isUnprojected,
    },
    path,
  };
}
