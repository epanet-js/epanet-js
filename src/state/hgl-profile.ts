import { atom } from "jotai";
import { AssetId } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { deriveProfilePath } from "src/panels/hgl-profile/path-finding";
import { HglRange, TerrainPoint } from "src/panels/hgl-profile/chart-types";
import { Mode, modeAtom } from "src/state/mode";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { EPSResultsReader } from "src/simulation";

export type { PathData };

export type HglProfile = {
  id: string;
  anchors: AssetId[];
  terrain: TerrainPoint[] | null;
  isUnprojected: boolean;
};

export type HglProfileUiPhase =
  | "idle"
  | "selectingStart"
  | "selectingEnd"
  | "showingProfile"
  | "pathBroken";

export const hglProfileAtom = atom<HglProfile | null>(null);

export const hglProfileOpenAtom = atom(false);

export const hasHglProfileAtom = atom(
  (get) =>
    get(hglProfileOpenAtom) ||
    get(hglProfileAtom) !== null ||
    get(modeAtom).mode === Mode.HGL_PROFILE,
);

export const profilePathAtom = atom<PathData | null>((get) => {
  const hglProfile = get(hglProfileAtom);
  if (!hglProfile) return null;
  const model = get(stagingModelDerivedAtom);
  return deriveProfilePath(model.topology, model.assets, hglProfile.anchors);
});

export const hglRangesAtom = atom(
  (get): Map<AssetId, HglRange | null> | null => {
    const path = get(profilePathAtom);
    if (!path) return null;

    const simulation = get(simulationDerivedAtom);
    const source =
      "epsResultsReader" in simulation && simulation.epsResultsReader
        ? simulation.epsResultsReader
        : null;
    // HGL profile ranges require the EPANET extended-period reader.
    if (!source || !("getHeadRangesForNodes" in source)) return null;
    const reader = source as unknown as EPSResultsReader;

    const model = get(stagingModelDerivedAtom);
    const ranges = new Map<AssetId, HglRange | null>();

    const nodeIds: AssetId[] = [];
    for (const nodeId of path.nodeIds) {
      const node = model.assets.get(nodeId);
      if (!node || node.isLink) continue;
      nodeIds.push(nodeId);
    }

    const rawRanges = reader.getHeadRangesForNodes(nodeIds);
    nodeIds.forEach((nodeId, i) => {
      const [min, max] = rawRanges[i];
      ranges.set(
        nodeId,
        min <= max ? { nodeId, minHead: min, maxHead: max } : null,
      );
    });

    return ranges;
  },
);
