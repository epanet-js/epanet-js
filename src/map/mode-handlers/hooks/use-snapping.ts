import { MapMouseEvent, MapTouchEvent } from "mapbox-gl";
import type { MapEngine } from "../../map-engine";
import { Position } from "src/types";
import { decodeId } from "src/lib/id";
import { AssetsMap, getNode, LinkAsset } from "src/hydraulic-model";
import {
  searchNearbyRenderedFeatures,
  DEFAULT_SNAP_DISTANCE_PIXELS,
} from "../../search";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import { SnappingCandidate } from "../draw-link/draw-link-handlers";
import { DataSource } from "../../data-source";

type SnappingOptions = {
  enableNodeSnapping?: boolean;
  enablePipeSnapping?: boolean;
};

type PipeSnapResult = {
  pipeId: number;
  snapPosition: Position;
  distance: number;
  vertexIndex: number | null;
};

export const useSnapping = (
  map: MapEngine,
  assetsMap: AssetsMap,
  options: SnappingOptions = {
    enableNodeSnapping: true,
    enablePipeSnapping: true,
  },
) => {
  const getNeighborPoint = (
    point: mapboxgl.Point,
    excludeIds?: number[],
  ): number | null => {
    if (!options.enableNodeSnapping) return null;

    const pointFeatures = searchNearbyRenderedFeatures(map, {
      point,
      layers: [
        "junctions",
        "imported-junctions",
        "reservoirs",
        "imported-reservoirs",
        "junction-results",
        "imported-junction-results",
        "icons-tanks",
        "icons-reservoirs",
      ],
    });
    if (!pointFeatures.length) return null;

    for (const feature of pointFeatures) {
      const id = feature.id;
      const decodedId = decodeId(id as RawId);
      const assetId = decodedId.featureId;

      if (assetId && (!excludeIds || !excludeIds.includes(assetId))) {
        if (map.isFeatureHidden(feature.source as DataSource, id as RawId)) {
          continue;
        }
        return assetId;
      }
    }

    return null;
  };

  const findNearestPipeToSnap = (
    screenPoint: mapboxgl.Point,
    mouseCoord: Position,
    excludeIds?: number[],
  ): PipeSnapResult | null => {
    if (!options.enablePipeSnapping) return null;

    const pipeFeatures = searchNearbyRenderedFeatures(map, {
      point: screenPoint,
      layers: ["pipes", "imported-pipes"],
    });

    if (!pipeFeatures.length) return null;

    let closestPipe: PipeSnapResult | null = null;

    for (const feature of pipeFeatures) {
      const id = feature.id;
      const decodedId = decodeId(id as RawId);
      const assetId = decodedId.featureId;
      if (!assetId) continue;

      if (excludeIds && excludeIds.includes(assetId)) continue;

      if (map.isFeatureHidden(feature.source as DataSource, id as RawId)) {
        continue;
      }

      const asset = assetsMap.get(assetId) as LinkAsset;
      if (!asset || !asset.isLink || asset.type !== "pipe") continue;

      const pipeGeometry = asset.feature.geometry;
      if (pipeGeometry.type !== "LineString") continue;

      const pipeLineString = lineString(pipeGeometry.coordinates);
      const mousePoint = point(mouseCoord);
      const result = findNearestPointOnLine(pipeLineString, mousePoint);

      let snapPosition = result.coordinates;
      let snappedVertexIndex: number | null = null;

      const mouseScreen = screenPoint;

      for (let i = 0; i < pipeGeometry.coordinates.length; i++) {
        const vertex = pipeGeometry.coordinates[i];
        const vertexScreen = map.map.project([vertex[0], vertex[1]]);
        const pixelDistance = Math.sqrt(
          Math.pow(vertexScreen.x - mouseScreen.x, 2) +
            Math.pow(vertexScreen.y - mouseScreen.y, 2),
        );

        if (pixelDistance < DEFAULT_SNAP_DISTANCE_PIXELS) {
          snapPosition = vertex;
          snappedVertexIndex = i;
          break;
        }
      }

      const distance = result.distance ?? Number.MAX_VALUE;
      if (!closestPipe || distance < closestPipe.distance) {
        closestPipe = {
          pipeId: assetId,
          snapPosition: snapPosition,
          distance: distance,
          vertexIndex: snappedVertexIndex,
        };
      }
    }

    return closestPipe;
  };

  const findSnappingCandidate = (
    e: MapMouseEvent | MapTouchEvent,
    mouseCoord?: Position,
    excludeIds?: number[],
  ): SnappingCandidate | null => {
    const coord = mouseCoord || [e.lngLat.lng, e.lngLat.lat];

    const assetId = getNeighborPoint(e.point, excludeIds);
    if (assetId) {
      const snappingNode = getNode(assetsMap, assetId);
      if (snappingNode) {
        return snappingNode;
      }
    }

    const pipeSnapResult = findNearestPipeToSnap(e.point, coord, excludeIds);
    if (pipeSnapResult) {
      return {
        type: "pipe",
        id: pipeSnapResult.pipeId,
        coordinates: pipeSnapResult.snapPosition,
        vertexIndex: pipeSnapResult.vertexIndex,
      };
    }

    return null;
  };

  return {
    findSnappingCandidate,
  };
};
