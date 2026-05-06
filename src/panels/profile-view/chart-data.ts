import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { LngLat } from "mapbox-gl";
import { useElevations } from "src/map/elevations/use-elevations";
import {
  profileViewAtom,
  ProfileViewPlot,
  ProfileViewUiPhase,
  PathData,
} from "src/state/profile-view";
import { Mode, modeAtom } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { type SimulationState } from "src/state/simulation";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import type { EPSResultsReader } from "src/simulation";
import { Highlight } from "src/state/highlights";
import { captureError } from "src/infra/error-tracking";
import { traceDuration } from "src/infra/with-instrumentation";
import { isDebugOn } from "src/infra/debug-mode";
import {
  buildPathSegments,
  PathSegment,
  interpolateAlongPolyline,
} from "./path-position";

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
  reversed: boolean;
};

export type TerrainSample = {
  cumulativeLength: number;
  coordinates: [number, number];
};

export type TerrainPoint = {
  cumulativeLength: number;
  elevation: number;
};

export type HglRange = {
  nodeId: AssetId;
  minHead: number;
  maxHead: number;
};

export type HglBandSegment = { x: number; min: number; max: number };

export type ProfileViewData = {
  phase: ProfileViewUiPhase;
  points: ProfilePoint[];
  links: ProfileLink[];
  pathSegments: PathSegment[];
  pathHighlights: Highlight[];
  terrainSamples: TerrainSample[][];
  // Chart-ready projections — same data, shape ECharts wants.
  elevationData: [number, number][];
  hglData: [number, number | null][];
  nodePositions: number[];
  totalLength: number;
  hasSimulation: boolean;
  pressureFactor: number | null;
  hglDropsData: ([number, number] | null)[];
  // Async, populated as fetches resolve.
  terrain: TerrainPoint[] | null;
  terrainData: [number, number][] | null;
  hglRanges: (HglRange | null)[] | null;
  hglBandSegments: HglBandSegment[][] | null;
};

type SyncProfileViewData = Omit<
  ProfileViewData,
  "phase" | "terrain" | "terrainData" | "hglRanges" | "hglBandSegments"
>;

export function useProfileViewData(): ProfileViewData {
  const plot = useAtomValue(profileViewAtom);
  const { mode } = useAtomValue(modeAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const model = useAtomValue(stagingModelDerivedAtom);
  const results = useAtomValue(simulationResultsDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);

  const phase = useMemo<ProfileViewUiPhase>(() => {
    if (plot !== null) return "showingProfile";
    if (mode !== Mode.PROFILE_VIEW) return "idle";
    if (
      ephemeralState.type === "profileView" &&
      ephemeralState.startNodeId !== undefined
    ) {
      return "selectingEnd";
    }
    return "selectingStart";
  }, [plot, mode, ephemeralState]);

  const sync = useMemo(
    () => computeProfileViewData(plot, model.assets, results ?? null),
    [plot, model.assets, results],
  );

  const terrain = useTerrainElevations(sync.terrainSamples);
  const hglRanges = useHglRanges(plot, simulation, model.assets);

  const terrainData = useMemo(() => buildTerrainData(terrain), [terrain]);
  const hglBandSegments = useMemo(
    () => buildHglBandSegments(sync.points, hglRanges),
    [sync.points, hglRanges],
  );

  return { phase, ...sync, terrain, terrainData, hglRanges, hglBandSegments };
}

function computeProfileViewData(
  plot: ProfileViewPlot | null,
  assets: AssetsMap,
  results: ResultsReader | null,
): SyncProfileViewData {
  if (plot === null) {
    return {
      points: [],
      links: [],
      pathSegments: [],
      pathHighlights: [],
      terrainSamples: [],
      elevationData: [],
      hglData: [],
      nodePositions: [],
      totalLength: 0,
      hasSimulation: false,
      pressureFactor: null,
      hglDropsData: [],
    };
  }

  const path = plot.path;

  const pathSegments = buildPathSegments(path, assets);
  const points = computeProfilePoints(path, assets, results);
  const links = computeProfileLinks(path, assets, results);
  const terrainSamples = computeTerrainSamples(pathSegments);
  const pathHighlights = buildPathHighlights(path);

  const elevationData = points.map<[number, number]>((p) => [
    p.cumulativeLength,
    p.elevation,
  ]);
  const hglData = points.map<[number, number | null]>((p) => [
    p.cumulativeLength,
    p.head,
  ]);
  const nodePositions = points.map((p) => p.cumulativeLength);
  const totalLength = nodePositions[nodePositions.length - 1] ?? 0;
  const hasSimulation = points.some(
    (p) => p.head !== null || p.pressure !== null,
  );
  const pressureFactor = computePressureFactor(points);
  const hglDropsData = buildHglDropsData(points, hasSimulation);

  return {
    points,
    links,
    pathSegments,
    pathHighlights,
    terrainSamples,
    elevationData,
    hglData,
    nodePositions,
    totalLength,
    hasSimulation,
    pressureFactor,
    hglDropsData,
  };
}

function computePressureFactor(points: ProfilePoint[]): number | null {
  for (const p of points) {
    if (p.pressure === null || p.head === null) continue;
    const headDiff = p.head - p.elevation;
    if (Math.abs(headDiff) > 1e-6) return p.pressure / headDiff;
  }
  return null;
}

function buildHglDropsData(
  points: ProfilePoint[],
  hasSimulation: boolean,
): ([number, number] | null)[] {
  if (!hasSimulation) return [];
  const result: ([number, number] | null)[] = [];
  for (const p of points) {
    if (p.head !== null) {
      result.push([p.cumulativeLength, p.head]);
      result.push([p.cumulativeLength, p.elevation]);
      result.push(null);
    }
  }
  return result;
}

function buildTerrainData(
  terrain: TerrainPoint[] | null,
): [number, number][] | null {
  if (!terrain) return null;
  return terrain.map<[number, number]>((t) => [
    t.cumulativeLength,
    t.elevation,
  ]);
}

function buildHglBandSegments(
  points: ProfilePoint[],
  hglRanges: (HglRange | null)[] | null,
): HglBandSegment[][] | null {
  return traceDuration("DEBUG PROFILE_VIEW:hglBandSegments", () => {
    if (!hglRanges || hglRanges.length !== points.length) return null;
    const segments: HglBandSegment[][] = [];
    let current: HglBandSegment[] | null = null;
    for (let i = 0; i < points.length; i++) {
      const r = hglRanges[i];
      if (r) {
        if (!current) current = [];
        current.push({
          x: points[i].cumulativeLength,
          min: r.minHead,
          max: r.maxHead,
        });
      } else {
        if (current && current.length >= 2) segments.push(current);
        current = null;
      }
    }
    if (current && current.length >= 2) segments.push(current);
    return segments.length > 0 ? segments : null;
  });
}

function computeProfilePoints(
  path: PathData,
  assets: AssetsMap,
  results: ResultsReader | null,
): ProfilePoint[] {
  return traceDuration("DEBUG PROFILE_VIEW:computeProfilePoints", () => {
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

      const linkId = path.linkIds[i];
      if (linkId !== undefined) {
        const link = assets.get(linkId);
        if (link && link.isLink) {
          cumulativeLength += (link as unknown as { length: number }).length;
        }
      }
    }

    return points;
  });
}

function computeProfileLinks(
  path: PathData,
  assets: AssetsMap,
  results: ResultsReader | null,
): ProfileLink[] {
  return traceDuration("DEBUG PROFILE_VIEW:computeProfileLinks", () => {
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
      const connections = (
        link as unknown as { connections: [AssetId, AssetId] }
      ).connections;
      const fromNodeId = path.nodeIds[i];
      const reversed = connections[0] !== fromNodeId;

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
          reversed,
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
          reversed,
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
          reversed,
        });
      }

      cumulativeLength = endLength;
    }

    return links;
  });
}

const TARGET_TERRAIN_SAMPLES = 250;
const MIN_TERRAIN_SPACING_M = 5;
const MAX_TERRAIN_SPACING_M = 200;

function computeTerrainSamples(segments: PathSegment[]): TerrainSample[][] {
  return traceDuration("DEBUG PROFILE_VIEW:computeTerrainSamples", () => {
    if (segments.length === 0) return [];

    const totalLength = segments[segments.length - 1].cumulativeEnd;
    if (totalLength <= 0) return [];

    const spacing = clamp(
      totalLength / TARGET_TERRAIN_SAMPLES,
      MIN_TERRAIN_SPACING_M,
      MAX_TERRAIN_SPACING_M,
    );
    const sampleCount = Math.max(2, Math.ceil(totalLength / spacing) + 1);

    const groups: TerrainSample[][] = segments.map(() => []);
    let segmentIndex = 0;
    for (let i = 0; i < sampleCount; i++) {
      const cumulativeLength =
        i === sampleCount - 1
          ? totalLength
          : (i * totalLength) / (sampleCount - 1);

      while (
        segmentIndex < segments.length - 1 &&
        cumulativeLength > segments[segmentIndex].cumulativeEnd
      ) {
        segmentIndex++;
      }

      const segment = segments[segmentIndex];
      const segmentSpan = segment.cumulativeEnd - segment.cumulativeStart;
      const fraction =
        segmentSpan > 0
          ? (cumulativeLength - segment.cumulativeStart) / segmentSpan
          : 0;
      const coordinates = interpolateAlongPolyline(
        segment.polyline,
        segment.geodesicLength,
        fraction,
      );
      groups[segmentIndex].push({ cumulativeLength, coordinates });
    }

    return groups;
  });
}

function buildPathHighlights(path: PathData): Highlight[] {
  const items: Highlight[] = [];
  for (const linkId of path.linkIds) {
    items.push({ type: "asset", assetId: linkId });
  }
  return items;
}

const BREATHING_DELAY_MS = 0;

function yieldToBrowser(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function useTerrainElevations(
  sampleGroups: TerrainSample[][],
): TerrainPoint[] | null {
  const [terrainPoints, setTerrainPoints] = useState<TerrainPoint[] | null>(
    null,
  );
  const { fetchElevations } = useElevations("m");

  const sampleKey =
    sampleGroups.length > 0
      ? sampleGroups
          .map((group) =>
            group
              .map((s) => `${s.cumulativeLength}:${s.coordinates.join(",")}`)
              .join("|"),
          )
          .join("||")
      : "";

  useEffect(() => {
    if (sampleGroups.length === 0) {
      setTerrainPoints(null);
      return;
    }

    setTerrainPoints([]);

    let cancelled = false;

    void (async () => {
      const start = performance.now();
      const accumulated: TerrainPoint[] = [];
      let totalSamples = 0;

      for (const group of sampleGroups) {
        if (cancelled) return;
        if (group.length === 0) continue;

        const elevations = await fetchElevations(
          group.map((s) => new LngLat(s.coordinates[0], s.coordinates[1])),
        );
        if (cancelled) return;

        for (let i = 0; i < group.length; i++) {
          accumulated.push({
            cumulativeLength: group[i].cumulativeLength,
            elevation: elevations[i],
          });
        }
        totalSamples += group.length;
        setTerrainPoints([...accumulated]);

        await yieldToBrowser(BREATHING_DELAY_MS);
      }

      if (isDebugOn) {
        //eslint-disable-next-line no-console
        console.log(
          `DEBUG PROFILE_VIEW:terrainElevations samples=${totalSamples} segments=${sampleGroups.length} time=${(
            performance.now() - start
          ).toFixed(2)} ms`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey, fetchElevations]);

  return terrainPoints;
}

type NodeRef = { nodeId: AssetId; type: "junction" | "tank" | "reservoir" };

function useHglRanges(
  plot: ProfileViewPlot | null,
  simulation: SimulationState,
  assets: AssetsMap,
): (HglRange | null)[] | null {
  const [ranges, setRanges] = useState<(HglRange | null)[] | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const epsResultsReader: EPSResultsReader | null =
    "epsResultsReader" in simulation && simulation.epsResultsReader
      ? simulation.epsResultsReader
      : null;

  const pathNodeIds = plot !== null ? plot.path.nodeIds : null;
  const pathKey = pathNodeIds ? pathNodeIds.join(",") : "";

  useEffect(() => {
    if (!pathNodeIds || !epsResultsReader) {
      setRanges(null);
      return;
    }

    const nodeRefs: (NodeRef | null)[] = pathNodeIds.map((nodeId) => {
      const asset = assets.get(nodeId);
      if (!asset || asset.isLink) return null;
      const type = asset.type;
      if (type !== "junction" && type !== "tank" && type !== "reservoir") {
        return null;
      }
      return { nodeId, type };
    });

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchAll = async () => {
      const start = performance.now();
      const results = await Promise.all(
        nodeRefs.map(async (ref) => {
          if (!ref) return null;
          try {
            let series;
            if (ref.type === "junction") {
              series = await epsResultsReader.getTimeSeries(
                ref.nodeId,
                "junction",
                "head",
              );
            } else if (ref.type === "tank") {
              series = await epsResultsReader.getTimeSeries(
                ref.nodeId,
                "tank",
                "head",
              );
            } else {
              series = await epsResultsReader.getTimeSeries(
                ref.nodeId,
                "reservoir",
                "head",
              );
            }
            if (!series || series.values.length === 0) return null;
            let min = series.values[0];
            let max = series.values[0];
            for (let i = 1; i < series.values.length; i++) {
              const v = series.values[i];
              if (v < min) min = v;
              if (v > max) max = v;
            }
            return { nodeId: ref.nodeId, minHead: min, maxHead: max };
          } catch (err) {
            captureError(err as Error);
            return null;
          }
        }),
      );

      if (isDebugOn) {
        //eslint-disable-next-line no-console
        console.log(
          `DEBUG PROFILE_VIEW:hglRange nodes=${nodeRefs.length} time=${(
            performance.now() - start
          ).toFixed(2)} ms`,
        );
      }
      if (controller.signal.aborted) return;
      setRanges(results);
    };

    void fetchAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, epsResultsReader, assets]);

  return ranges;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
