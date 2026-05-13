import { nanoid } from "nanoid";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { ResultsReader } from "src/simulation/results-reader";
import { ProfileView } from "src/state/profile-view";
import { deriveProfilePath } from "./path-finding";

export type BuildProfileViewArgs = {
  anchorIds: AssetId[];
  hydraulicModel: HydraulicModel;
  isUnprojected: boolean;
  results?: ResultsReader | null;
};

export type BuildProfileViewResult =
  | { profileView: ProfileView; path: PathData }
  | { error: "noPath" };

export function buildProfileView({
  anchorIds,
  hydraulicModel,
  isUnprojected,
  results = null,
}: BuildProfileViewArgs): BuildProfileViewResult {
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
    profileView: {
      id: nanoid(),
      anchors: path.nodeIds,
      terrain: null,
      isUnprojected,
    },
    path,
  };
}
