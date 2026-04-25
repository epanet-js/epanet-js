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
  nodeType: "junction" | "tank" | "reservoir";
  cumulativeLength: number;
  elevation: number;
  head: number | null;
  pressure: number | null;
  label: string;
  coordinates: [number, number];
};

export type ProfileLink = {
  linkId: AssetId;
  type: "pipe" | "pump" | "valve";
  valveKind?: string;
  status: string;
  isActive: boolean;
  startLength: number;
  endLength: number;
  midLength: number;
  label: string;
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

export function useProfileLinks(): ProfileLink[] | null {
  const profileView = useAtomValue(profileViewAtom);
  const model = useAtomValue(stagingModelDerivedAtom);
  const results = useAtomValue(simulationResultsDerivedAtom);

  return useMemo(() => {
    if (profileView.phase !== "showingProfile") return null;
    return computeProfileLinks(profileView.path, model.assets, results ?? null);
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
      nodeType: node.type as "junction" | "tank" | "reservoir",
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

function computeProfileLinks(
  path: PathData,
  assets: AssetsMap,
  results: ResultsReader | null,
): ProfileLink[] {
  const links: ProfileLink[] = [];
  let cumulativeLength = 0;

  for (let i = 0; i < path.linkIds.length; i++) {
    const linkId = path.linkIds[i];
    const link = assets.get(linkId);
    if (!link || !link.isLink) continue;

    const linkLength = (link as unknown as { length: number }).length;
    const startLength = cumulativeLength;
    const endLength = cumulativeLength + linkLength;
    const midLength = startLength + linkLength / 2;
    const isActive = (link as unknown as { isActive: boolean }).isActive;

    const linkType = link.type as "pipe" | "pump" | "valve";

    if (linkType === "pipe") {
      const initialStatus = (link as unknown as { initialStatus: string })
        .initialStatus;
      const simStatus = results?.getPipe(linkId)?.status ?? null;
      const status = isActive ? (simStatus ?? initialStatus) : "disabled";
      links.push({
        linkId,
        type: "pipe",
        status,
        isActive,
        startLength,
        endLength,
        midLength,
        label: link.label,
      });
    } else if (linkType === "pump") {
      const initialStatus = (link as unknown as { initialStatus: string })
        .initialStatus;
      const simStatus = results?.getPump(linkId)?.status ?? null;
      const status = !isActive ? "disabled" : (simStatus ?? initialStatus);
      links.push({
        linkId,
        type: "pump",
        status,
        isActive,
        startLength,
        endLength,
        midLength,
        label: link.label,
      });
    } else if (linkType === "valve") {
      const initialStatus = (link as unknown as { initialStatus: string })
        .initialStatus;
      const valveKind = (link as unknown as { kind: string }).kind;
      const simStatus = results?.getValve(linkId)?.status ?? null;
      const status = !isActive ? "disabled" : (simStatus ?? initialStatus);
      links.push({
        linkId,
        type: "valve",
        valveKind,
        status,
        isActive,
        startLength,
        endLength,
        midLength,
        label: link.label,
      });
    }

    cumulativeLength = endLength;
  }

  return links;
}
