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

    for (const nodeId of path.nodeIds) {
      const node = model.assets.get(nodeId);
      if (!node || node.isLink) continue;
      const nodeType = node.type as "junction" | "tank" | "reservoir";

      try {
        const series =
          nodeType === "junction"
            ? await reader.getTimeSeries(nodeId, "junction", "head")
            : nodeType === "tank"
              ? await reader.getTimeSeries(nodeId, "tank", "head")
              : await reader.getTimeSeries(nodeId, "reservoir", "head");

        if (!series || series.values.length === 0) {
          ranges.set(nodeId, null);
          continue;
        }
        let min = series.values[0];
        let max = series.values[0];
        for (let i = 1; i < series.values.length; i++) {
          const v = series.values[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        ranges.set(nodeId, { nodeId, minHead: min, maxHead: max });
      } catch (err) {
        captureError(err as Error);
        ranges.set(nodeId, null);
      }
    }

    return ranges;
  },
);

export const hglRangesAtom = unwrap(hglRangesAsyncAtom, (prev) => prev ?? null);
