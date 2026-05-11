import { useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { LngLat } from "mapbox-gl";
import { useElevations } from "src/map/elevations/use-elevations";
import {
  profileViewAtom,
  ProfileViewSnapshot,
  ProfileViewUiPhase,
  PathData,
} from "src/state/profile-view";
import { Mode, modeAtom } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { type SimulationState } from "src/state/simulation";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import { Highlight } from "src/state/highlights";
import { captureError } from "src/infra/error-tracking";
import { traceDuration } from "src/infra/with-instrumentation";
import { isDebugOn } from "src/infra/debug-mode";
import { Unit } from "src/quantity";
import {
  buildPathSegments,
  PathSegment,
  interpolateAlongPolyline,
} from "./path-position";
import {
  HglBandSegment,
  HglRange,
  ProfileLink,
  ProfilePoint,
  SyncProfileViewData,
  TerrainPoint,
  TerrainSample,
} from "./chart-types";

export type {
  HglBandSegment,
  HglRange,
  ProfileLink,
  ProfilePoint,
  TerrainPoint,
  TerrainSample,
};

export type ProfileViewData = {
  phase: ProfileViewUiPhase;
  points: ProfilePoint[];
  links: ProfileLink[];
  pathSegments: PathSegment[];
  pathHighlights: Highlight[];
  terrainSamples: TerrainSample[];
  elevationData: [number, number][];
  hglData: [number, number | null][];
  nodePositions: number[];
  totalLength: number;
  hasSimulation: boolean;
  pressureFactor: number | null;
  hglDropsData: ([number, number] | null)[];
  terrain: TerrainPoint[] | null;
  terrainData: [number, number][] | null;
  hglRanges: (HglRange | null)[] | null;
  hglBandSegments: HglBandSegment[][] | null;
  elevationUnit: Unit;
  lengthUnit: Unit;
  pressureUnit: Unit;
  elevationDecimals: number;
  pressureDecimals: number;
  lengthDecimals: number;
  isUnprojected: boolean;
};

export function useProfileViewData(): ProfileViewData {
  const snapshot = useAtomValue(profileViewAtom);
  const setSnapshot = useSetAtom(profileViewAtom);
  const { mode } = useAtomValue(modeAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const model = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);

  const isBroken = useMemo(() => {
    if (snapshot === null) return false;
    for (const id of snapshot.nodeIds) {
      if (!model.assets.get(id)) return true;
    }
    for (const id of snapshot.linkIds) {
      if (!model.assets.get(id)) return true;
    }
    return false;
  }, [snapshot, model.assets]);

  const phase = useMemo<ProfileViewUiPhase>(() => {
    if (snapshot !== null && isBroken) return "pathBroken";
    if (snapshot !== null) return "showingProfile";
    if (mode !== Mode.PROFILE_VIEW) return "idle";
    if (
      ephemeralState.type === "profileView" &&
      ephemeralState.startNodeId !== undefined
    ) {
      return "selectingEnd";
    }
    return "selectingStart";
  }, [snapshot, isBroken, mode, ephemeralState]);

  useFetchTerrainOnce(snapshot, setSnapshot);
  useFetchHglRangesOnce(snapshot, simulation, setSnapshot);

  const hglBandSegments = useMemo(
    () =>
      snapshot
        ? buildHglBandSegments(snapshot.data.points, snapshot.hglRanges)
        : null,
    [snapshot],
  );
  const terrainData = useMemo(
    () => (snapshot ? buildTerrainData(snapshot.terrain) : null),
    [snapshot],
  );

  if (!snapshot || isBroken) {
    return buildEmptyData(phase);
  }

  return {
    phase,
    ...snapshot.data,
    terrain: snapshot.terrain,
    terrainData,
    hglRanges: snapshot.hglRanges,
    hglBandSegments,
    elevationUnit: snapshot.units.elevation,
    lengthUnit: snapshot.units.length,
    pressureUnit: snapshot.units.pressure,
    elevationDecimals: snapshot.decimals.elevation,
    pressureDecimals: snapshot.decimals.pressure,
    lengthDecimals: snapshot.decimals.length,
    isUnprojected: snapshot.isUnprojected,
  };
}

function buildEmptyData(phase: ProfileViewUiPhase): ProfileViewData {
  return {
    phase,
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
    terrain: null,
    terrainData: null,
    hglRanges: null,
    hglBandSegments: null,
    elevationUnit: "m" as Unit,
    lengthUnit: "m" as Unit,
    pressureUnit: "m" as Unit,
    elevationDecimals: 2,
    pressureDecimals: 2,
    lengthDecimals: 0,
    isUnprojected: false,
  };
}

export function computeProfileViewData(
  path: PathData | null,
  assets: AssetsMap,
  results: ResultsReader | null,
): SyncProfileViewData {
  if (path === null) {
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

function computeTerrainSamples(segments: PathSegment[]): TerrainSample[] {
  return traceDuration("DEBUG PROFILE_VIEW:computeTerrainSamples", () => {
    if (segments.length === 0) return [];

    const totalLength = segments[segments.length - 1].cumulativeEnd;
    if (totalLength <= 0) return [];

    const totalGeodesicMeters = segments.reduce(
      (sum, s) => sum + s.geodesicLength,
      0,
    );
    const geodesicSpacing = clamp(
      totalGeodesicMeters / TARGET_TERRAIN_SAMPLES,
      MIN_TERRAIN_SPACING_M,
      MAX_TERRAIN_SPACING_M,
    );
    const sampleCount =
      totalGeodesicMeters > 0
        ? Math.max(2, Math.ceil(totalGeodesicMeters / geodesicSpacing) + 1)
        : 2;

    const samples: TerrainSample[] = [];
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
      samples.push({ cumulativeLength, coordinates });
    }

    return samples;
  });
}

function buildPathHighlights(path: PathData): Highlight[] {
  const items: Highlight[] = [];
  for (const linkId of path.linkIds) {
    items.push({ type: "asset", assetId: linkId });
  }
  return items;
}

type SnapshotUpdater = (
  updater: (curr: ProfileViewSnapshot | null) => ProfileViewSnapshot | null,
) => void;

function useFetchTerrainOnce(
  snapshot: ProfileViewSnapshot | null,
  setSnapshot: SnapshotUpdater,
) {
  const elevationUnit: Unit = snapshot?.units.elevation ?? ("m" as Unit);
  const { fetchElevations } = useElevations(elevationUnit);

  const snapshotId = snapshot?.id ?? null;

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.terrain !== null) return;
    if (snapshot.isUnprojected) return;
    if (snapshot.data.terrainSamples.length === 0) return;

    let cancelled = false;
    const samples = snapshot.data.terrainSamples;
    const capturedId = snapshot.id;
    const start = performance.now();

    void fetchElevations(
      samples.map((s) => new LngLat(s.coordinates[0], s.coordinates[1])),
    ).then((elevations) => {
      if (cancelled) return;

      if (isDebugOn) {
        //eslint-disable-next-line no-console
        console.log(
          `DEBUG PROFILE_VIEW:terrainElevations samples=${samples.length} time=${(
            performance.now() - start
          ).toFixed(2)} ms`,
        );
      }

      const terrain: TerrainPoint[] = elevations.map((elevation, i) => ({
        cumulativeLength: samples[i].cumulativeLength,
        elevation,
      }));
      setSnapshot((curr) =>
        curr && curr.id === capturedId ? { ...curr, terrain } : curr,
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId]);
}

function useFetchHglRangesOnce(
  snapshot: ProfileViewSnapshot | null,
  simulation: SimulationState,
  setSnapshot: SnapshotUpdater,
) {
  const snapshotId = snapshot?.id ?? null;

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.hglRanges !== null) return;
    if (snapshot.data.points.length === 0) return;

    const epsResultsReader =
      "epsResultsReader" in simulation && simulation.epsResultsReader
        ? simulation.epsResultsReader
        : null;
    if (!epsResultsReader) return;

    const controller = new AbortController();
    const points = snapshot.data.points;
    const capturedId = snapshot.id;
    const capturedReader = epsResultsReader;

    const fetchAll = async () => {
      const start = performance.now();
      const results: (HglRange | null)[] = new Array(points.length);
      for (let i = 0; i < points.length; i++) {
        if (controller.signal.aborted) return;
        const point = points[i];
        try {
          const series =
            point.nodeType === "junction"
              ? await capturedReader.getTimeSeries(
                  point.nodeId,
                  "junction",
                  "head",
                )
              : point.nodeType === "tank"
                ? await capturedReader.getTimeSeries(
                    point.nodeId,
                    "tank",
                    "head",
                  )
                : await capturedReader.getTimeSeries(
                    point.nodeId,
                    "reservoir",
                    "head",
                  );
          if (!series || series.values.length === 0) {
            results[i] = null;
            continue;
          }
          let min = series.values[0];
          let max = series.values[0];
          for (let j = 1; j < series.values.length; j++) {
            const v = series.values[j];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          results[i] = { nodeId: point.nodeId, minHead: min, maxHead: max };
        } catch (err) {
          captureError(err as Error);
          results[i] = null;
        }
      }

      if (isDebugOn) {
        //eslint-disable-next-line no-console
        console.log(
          `DEBUG PROFILE_VIEW:hglRange nodes=${points.length} time=${(
            performance.now() - start
          ).toFixed(2)} ms`,
        );
      }
      if (controller.signal.aborted) return;
      setSnapshot((curr) =>
        curr && curr.id === capturedId ? { ...curr, hglRanges: results } : curr,
      );
    };

    void fetchAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
