import { nanoid } from "nanoid";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import { ProfileView } from "src/state/profile-view";
import { findProfilePath } from "./path-finding";

export type BuildProfileViewArgs = {
  startNodeId: AssetId;
  endNodeId: AssetId;
  hydraulicModel: HydraulicModel;
  results: ResultsReader | null;
  isUnprojected: boolean;
};

export type BuildProfileViewResult =
  | { profileView: ProfileView }
  | { error: "noPath" };

export function buildProfileView({
  startNodeId,
  endNodeId,
  hydraulicModel,
  results,
  isUnprojected,
}: BuildProfileViewArgs): BuildProfileViewResult {
  const path = findProfilePath(
    hydraulicModel.topology,
    hydraulicModel.assets,
    startNodeId,
    endNodeId,
    results,
  );

  if (path === null) {
    return { error: "noPath" };
  }

  return {
    profileView: {
      id: nanoid(),
      startNodeId,
      endNodeId,
      nodeIds: path.nodeIds,
      linkIds: path.linkIds,
      terrain: null,
      hglRanges: null,
      isUnprojected,
    },
  };
}
