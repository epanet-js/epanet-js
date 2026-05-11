import { nanoid } from "nanoid";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import { ProjectSettings } from "src/lib/project-settings";
import { getDecimals } from "src/lib/project-settings";
import { ProfileViewSnapshot } from "src/state/profile-view";
import { computeProfileViewData } from "./chart-data";
import { shortestPathByDistance, shortestPathByFlow } from "./path-finding";

export type BuildProfileViewSnapshotArgs = {
  startNodeId: AssetId;
  endNodeId: AssetId;
  hydraulicModel: HydraulicModel;
  results: ResultsReader | null;
  projectSettings: ProjectSettings;
  isUnprojected: boolean;
};

export type BuildProfileViewSnapshotResult =
  | { snapshot: ProfileViewSnapshot }
  | { error: "noPath" };

export function buildProfileViewSnapshot({
  startNodeId,
  endNodeId,
  hydraulicModel,
  results,
  projectSettings,
  isUnprojected,
}: BuildProfileViewSnapshotArgs): BuildProfileViewSnapshotResult {
  const path = results
    ? shortestPathByFlow(
        hydraulicModel.topology,
        hydraulicModel.assets,
        results,
        startNodeId,
        endNodeId,
      )
    : shortestPathByDistance(
        hydraulicModel.topology,
        hydraulicModel.assets,
        startNodeId,
        endNodeId,
      );

  if (path === null) {
    return { error: "noPath" };
  }

  const data = computeProfileViewData(path, hydraulicModel.assets, results);

  const { units, formatting } = projectSettings;
  const snapshot: ProfileViewSnapshot = {
    id: nanoid(),
    startNodeId,
    endNodeId,
    nodeIds: path.nodeIds,
    linkIds: path.linkIds,
    data,
    terrain: null,
    hglRanges: null,
    units: {
      elevation: units.elevation,
      length: units.length,
      pressure: units.pressure,
    },
    decimals: {
      elevation: getDecimals(formatting, "elevation") ?? 2,
      length: getDecimals(formatting, "length") ?? 0,
      pressure: getDecimals(formatting, "pressure") ?? 2,
    },
    isUnprojected,
  };

  return { snapshot };
}
