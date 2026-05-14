import { atom } from "jotai";
import { unwrap } from "jotai/utils";
import { AssetId } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { deriveProfilePath } from "src/panels/profile-view/path-finding";
import { HglRange, TerrainPoint } from "src/panels/profile-view/chart-types";
import { Mode, modeAtom } from "src/state/mode";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { captureError } from "src/infra/error-tracking";

export type { PathData };

export type ProfileView = {
  id: string;
  anchors: AssetId[];
  terrain: TerrainPoint[] | null;
  isUnprojected: boolean;
};

export type ProfileViewUiPhase =
  | "idle"
  | "selectingStart"
  | "selectingEnd"
  | "showingProfile"
  | "pathBroken";

export const profileViewAtom = atom<ProfileView | null>(null);

export const profileViewOpenAtom = atom(false);

export const hasProfileViewAtom = atom(
  (get) =>
    get(profileViewOpenAtom) ||
    get(profileViewAtom) !== null ||
    get(modeAtom).mode === Mode.PROFILE_VIEW,
);

export const profilePathAtom = atom<PathData | null>((get) => {
  const profileView = get(profileViewAtom);
  if (!profileView) return null;
  const model = get(stagingModelDerivedAtom);
  return deriveProfilePath(model.topology, model.assets, profileView.anchors);
});

const hglRangesAsyncAtom = atom(
  async (get): Promise<Map<AssetId, HglRange | null> | null> => {
    const path = get(profilePathAtom);
    if (!path) return null;

    const simulation = get(simulationDerivedAtom);
    const reader =
      "epsResultsReader" in simulation && simulation.epsResultsReader
        ? simulation.epsResultsReader
        : null;
    if (!reader) return null;

    const model = get(stagingModelDerivedAtom);
    const ranges = new Map<AssetId, HglRange | null>();

    const nodeIds: AssetId[] = [];
    for (const nodeId of path.nodeIds) {
      const node = model.assets.get(nodeId);
      if (!node || node.isLink) continue;
      nodeIds.push(nodeId);
    }

    try {
      const rawRanges = await reader.getHeadRangesForNodes(nodeIds);
      for (const nodeId of nodeIds) {
        const range = rawRanges.get(nodeId);
        ranges.set(
          nodeId,
          range ? { nodeId, minHead: range.min, maxHead: range.max } : null,
        );
      }
    } catch (err) {
      captureError(err as Error);
      for (const nodeId of nodeIds) ranges.set(nodeId, null);
    }

    return ranges;
  },
);

export const hglRangesAtom = unwrap(hglRangesAsyncAtom, (prev) => prev ?? null);
