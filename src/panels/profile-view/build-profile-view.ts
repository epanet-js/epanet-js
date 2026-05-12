import { nanoid } from "nanoid";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { ProfileView } from "src/state/profile-view";
import { findProfilePath } from "./path-finding";

export type BuildProfileViewArgs = {
  startNodeId: AssetId;
  endNodeId: AssetId;
  hydraulicModel: HydraulicModel;
  isUnprojected: boolean;
};

export type BuildProfileViewResult =
  | { profileView: ProfileView; path: PathData }
  | { error: "noPath" };

export function buildProfileView({
  startNodeId,
  endNodeId,
  hydraulicModel,
  isUnprojected,
}: BuildProfileViewArgs): BuildProfileViewResult {
  const path = findProfilePath(
    hydraulicModel.topology,
    hydraulicModel.assets,
    startNodeId,
    endNodeId,
  );

  if (path === null) {
    return { error: "noPath" };
  }

  return {
    profileView: {
      id: nanoid(),
      anchors: [startNodeId, endNodeId],
      terrain: null,
      isUnprojected,
    },
    path,
  };
}
