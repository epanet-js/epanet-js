import { useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { LngLat } from "mapbox-gl";
import { useElevations } from "src/map/elevations/use-elevations";
import {
  hglProfileAtom,
  profilePathAtom,
  hglRangesAtom,
  HglProfile,
  HglProfileUiPhase,
  PathData,
} from "src/state/hgl-profile";
import { Mode, modeAtom } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { getDecimals, ProjectSettings } from "src/lib/project-settings";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import { Highlight } from "src/state/highlights";
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

export type HglProfileData = {
  phase: HglProfileUiPhase;
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

export function useHglProfileData(): HglProfileData {
  const hglProfile = useAtomValue(hglProfileAtom);
  const setHglProfile = useSetAtom(hglProfileAtom);
  const { mode } = useAtomValue(modeAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const model = useAtomValue(stagingModelDerivedAtom);
  const results = useAtomValue(simulationResultsDerivedAtom);
  const path = useAtomValue(profilePathAtom);
  const hglRanges = useAtomValue(hglRangesAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);

  const phase = useMemo<HglProfileUiPhase>(() => {
    if (hglProfile !== null && path === null) return "pathBroken";
    if (hglProfile !== null) return "showingProfile";
    if (mode !== Mode.HGL_PROFILE) return "idle";
    if (
      ephemeralState.type === "hglProfile" &&
      (ephemeralState.anchorIds?.length ?? 0) > 0
    ) {
      return "selectingEnd";
    }
    return "selectingStart";
  }, [hglProfile, path, mode, ephemeralState]);

  const pathSegments = useMemo(
    () => (path ? buildPathSegments(path, model.assets) : []),
    [path, model.assets],
  );

  const points = useMemo(
    () => (path ? computeProfilePoints(path, model.assets, results) : []),
    [path, model.assets, results],
  );

  const links = useMemo(
    () => (path ? computeProfileLinks(path, model.assets, results) : []),
    [path, model.assets, results],
  );

  const terrainSamples = useMemo(
    () => computeTerrainSamples(pathSegments),
    [pathSegments],
  );

  const pathHighlights = useMemo(
    () => (path ? buildPathHighlights(path) : []),
    [path],
  );

  const elevationData = useMemo(
    () =>
      points.map<[number, number]>((p) => [p.cumulativeLength, p.elevation]),
    [points],
  );

  const hglData = useMemo(
    () =>
      points.map<[number, number | null]>((p) => [p.cumulativeLength, p.head]),
    [points],
  );

  const nodePositions = useMemo(
    () => points.map((p) => p.cumulativeLength),
    [points],
  );

  const totalLength = nodePositions[nodePositions.length - 1] ?? 0;

  const hasSimulation = useMemo(
    () => points.some((p) => p.head !== null || p.pressure !== null),
    [points],
  );

  const pressureFactor = useMemo(() => computePressureFactor(points), [points]);

  const hglDropsData = useMemo(
    () => buildHglDropsData(points, hasSimulation),
    [points, hasSimulation],
  );

  const hglBandSegments = useMemo(
    () => buildHglBandSegments(points, hglRanges),
    [points, hglRanges],
  );

  const hglRangesList = useMemo(
    () =>
      hglRanges ? points.map((p) => hglRanges.get(p.nodeId) ?? null) : null,
    [points, hglRanges],
  );

  const terrainData = useMemo(
    () => (hglProfile ? buildTerrainData(hglProfile.terrain) : null),
    [hglProfile],
  );

  useFetchTerrainOnce({
    hglProfile,
    terrainSamples,
    setHglProfile,
    elevationUnit: projectSettings.units.elevation,
  });

  if (!hglProfile || !path) {
    return buildEmptyData(phase, projectSettings);
  }

  return {
    phase,
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
    terrain: hglProfile.terrain,
    terrainData,
    hglRanges: hglRangesList,
    hglBandSegments,
    elevationUnit: projectSettings.units.elevation,
    lengthUnit: projectSettings.units.length,
    pressureUnit: projectSettings.units.pressure,
    elevationDecimals:
      getDecimals(projectSettings.formatting, "elevation") ?? 2,
    lengthDecimals: getDecimals(projectSettings.formatting, "length") ?? 0,
    pressureDecimals: getDecimals(projectSettings.formatting, "pressure") ?? 2,
    isUnprojected: hglProfile.isUnprojected,
  };
}

function buildEmptyData(
  phase: HglProfileUiPhase,
  projectSettings: ProjectSettings,
): HglProfileData {
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
    elevationUnit: projectSettings.units.elevation,
    lengthUnit: projectSettings.units.length,
    pressureUnit: projectSettings.units.pressure,
    elevationDecimals:
      getDecimals(projectSettings.formatting, "elevation") ?? 2,
    lengthDecimals: getDecimals(projectSettings.formatting, "length") ?? 0,
    pressureDecimals: getDecimals(projectSettings.formatting, "pressure") ?? 2,
    isUnprojected: false,
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
  hglRanges: Map<AssetId, HglRange | null> | null,
): HglBandSegment[][] | null {
  return traceDuration("DEBUG HGL_PROFILE:hglBandSegments", () => {
    if (!hglRanges) return null;
    const segments: HglBandSegment[][] = [];
    let current: HglBandSegment[] | null = null;
    for (let i = 0; i < points.length; i++) {
      const r = hglRanges.get(points[i].nodeId) ?? null;
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
  return traceDuration("DEBUG HGL_PROFILE:computeProfilePoints", () => {
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
  return traceDuration("DEBUG HGL_PROFILE:computeProfileLinks", () => {
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
  return traceDuration("DEBUG HGL_PROFILE:computeTerrainSamples", () => {
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

type HglProfileUpdater = (
  updater: (curr: HglProfile | null) => HglProfile | null,
) => void;

function useFetchTerrainOnce({
  hglProfile,
  terrainSamples,
  setHglProfile,
  elevationUnit,
}: {
  hglProfile: HglProfile | null;
  terrainSamples: TerrainSample[];
  setHglProfile: HglProfileUpdater;
  elevationUnit: Unit;
}) {
  const { fetchElevations } = useElevations(elevationUnit);

  const hglProfileId = hglProfile?.id ?? null;

  useEffect(() => {
    if (!hglProfile) return;
    if (hglProfile.terrain !== null) return;
    if (hglProfile.isUnprojected) return;
    if (terrainSamples.length === 0) return;

    let cancelled = false;
    const samples = terrainSamples;
    const capturedId = hglProfile.id;
    const start = performance.now();

    void fetchElevations(
      samples.map((s) => new LngLat(s.coordinates[0], s.coordinates[1])),
    ).then((elevations) => {
      if (cancelled) return;

      if (isDebugOn) {
        //eslint-disable-next-line no-console
        console.log(
          `DEBUG HGL_PROFILE:terrainElevations samples=${samples.length} time=${(
            performance.now() - start
          ).toFixed(2)} ms`,
        );
      }

      const terrain: TerrainPoint[] = elevations.map((elevation, i) => ({
        cumulativeLength: samples[i].cumulativeLength,
        elevation,
      }));
      setHglProfile((curr) =>
        curr && curr.id === capturedId ? { ...curr, terrain } : curr,
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hglProfileId]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
