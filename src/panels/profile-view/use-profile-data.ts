import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { profileViewAtom, PathData } from "src/state/profile-view";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import { computeTerrainSamples, TerrainSample } from "./terrain-samples";

export type ProfilePoint = {
  nodeId: AssetId;
  cumulativeLength: number;
  elevation: number;
  head: number | null;
  pressure: number | null;
  label: string;
  coordinates: [number, number];
};

export function useProfileData(): ProfilePoint[] | null {
  const profileView = useAtomValue(profileViewAtom);
  const model = useAtomValue(stagingModelDerivedAtom);
  const results = useAtomValue(simulationResultsDerivedAtom);

  return useMemo(() => {
    if (profileView.phase !== "showingProfile") return null;
    return computeProfilePoints(
      profileView.path,
      model.assets,
      results ?? null,
    );
  }, [profileView, model.assets, results]);
}

export function useTerrainSamples(): TerrainSample[] | null {
  const profileView = useAtomValue(profileViewAtom);
  const model = useAtomValue(stagingModelDerivedAtom);

  return useMemo(() => {
    if (profileView.phase !== "showingProfile") return null;
    return computeTerrainSamples(profileView.path, model.assets);
  }, [profileView, model.assets]);
}

function computeProfilePoints(
  path: PathData,
  assets: AssetsMap,
  results: ResultsReader | null,
): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  let cumulativeLength = 0;

  for (let i = 0; i < path.nodeIds.length; i++) {
    const nodeId = path.nodeIds[i];
    const node = assets.get(nodeId);
    if (!node || node.isLink) continue;

    const elevation = (node as unknown as { elevation: number }).elevation;
    let head: number | null = null;
    let pressure: number | null = null;

    if (results) {
      const nodeType = node.type;
      if (nodeType === "junction") {
        const r = results.getJunction(nodeId);
        if (r) {
          head = r.head;
          pressure = r.pressure;
        }
      } else if (nodeType === "tank") {
        const r = results.getTank(nodeId);
        if (r) {
          head = r.head;
          pressure = r.pressure;
        }
      } else if (nodeType === "reservoir") {
        const r = results.getReservoir(nodeId);
        if (r) {
          head = r.head;
          pressure = r.pressure;
        }
      }
    }

    points.push({
      nodeId,
      cumulativeLength,
      elevation,
      head,
      pressure,
      label: node.label,
      coordinates: node.coordinates as [number, number],
    });

    // Accumulate length via the link connecting node i to node i+1
    const linkId = path.linkIds[i];
    if (linkId !== undefined) {
      const link = assets.get(linkId);
      if (link && link.isLink) {
        cumulativeLength += (link as unknown as { length: number }).length;
      }
    }
  }

  return points;
}
