import { nanoid } from "nanoid";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { ProfileView } from "src/state/profile-view";
import { deriveProfilePath } from "./path-finding";

export type BuildProfileViewArgs = {
  anchorIds: AssetId[];
  hydraulicModel: HydraulicModel;
  isUnprojected: boolean;
};

export type BuildProfileViewResult =
  | { profileView: ProfileView; path: PathData }
  | { error: "noPath" };

export function buildProfileView({
  anchorIds,
  hydraulicModel,
  isUnprojected,
}: BuildProfileViewArgs): BuildProfileViewResult {
  const path = deriveProfilePath(
    hydraulicModel.topology,
    hydraulicModel.assets,
    anchorIds,
  );

  if (path === null) {
    return { error: "noPath" };
  }

  return {
    profileView: {
      id: nanoid(),
      anchors: anchorIds,
      terrain: null,
      isUnprojected,
    },
    path,
  };
}
