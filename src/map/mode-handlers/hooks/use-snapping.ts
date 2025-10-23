import { MapMouseEvent, MapTouchEvent } from "mapbox-gl";
import { IDMap, UIDMap } from "src/lib/id-mapper";
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
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type SnappingOptions = {
  enableNodeSnapping?: boolean;
  enablePipeSnapping?: boolean;
};

type PipeSnapResult = {
  pipeId: string;
  snapPosition: Position;
  distance: number;
};

export const useSnapping = (
  map: MapEngine,
  idMap: IDMap,
  assetsMap: AssetsMap,
  options: SnappingOptions = {
    enableNodeSnapping: true,
    enablePipeSnapping: true,
  },
) => {
  const isVertexSnapOn = useFeatureFlag("FLAG_VERTEX_SNAP");
  const getNeighborPoint = (
    point: mapboxgl.Point,
    excludeIds?: string[],
  ): string | null => {
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
      const uuid = UIDMap.getUUID(idMap, decodedId.featureId);

      if (uuid && (!excludeIds || !excludeIds.includes(uuid))) {
        if (map.isFeatureHidden(feature.source as DataSource, id as RawId)) {
          continue;
        }
        return uuid;
      }
    }

    return null;
  };

  const findNearestPipeToSnap = (
    screenPoint: mapboxgl.Point,
    mouseCoord: Position,
    excludeIds?: string[],
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
      const uuid = UIDMap.getUUID(idMap, decodedId.featureId);
      if (!uuid) continue;

      if (excludeIds && excludeIds.includes(uuid)) continue;

      if (map.isFeatureHidden(feature.source as DataSource, id as RawId)) {
        continue;
      }

      const asset = assetsMap.get(uuid) as LinkAsset;
      if (!asset || !asset.isLink || asset.type !== "pipe") continue;

      const pipeGeometry = asset.feature.geometry;
      if (pipeGeometry.type !== "LineString") continue;

      const pipeLineString = lineString(pipeGeometry.coordinates);
      const mousePoint = point(mouseCoord);
      const result = findNearestPointOnLine(pipeLineString, mousePoint);

      let snapPosition = result.coordinates;

      if (isVertexSnapOn) {
        const mouseScreen = screenPoint;

        for (const vertex of pipeGeometry.coordinates) {
          const vertexScreen = map.map.project([vertex[0], vertex[1]]);
          const pixelDistance = Math.sqrt(
            Math.pow(vertexScreen.x - mouseScreen.x, 2) +
              Math.pow(vertexScreen.y - mouseScreen.y, 2),
          );

          if (pixelDistance < DEFAULT_SNAP_DISTANCE_PIXELS) {
            snapPosition = vertex;
            break;
          }
        }
      }

      const distance = result.distance ?? Number.MAX_VALUE;
      if (!closestPipe || distance < closestPipe.distance) {
        closestPipe = {
          pipeId: uuid,
          snapPosition: snapPosition,
          distance: distance,
        };
      }
    }

    return closestPipe;
  };

  const findSnappingCandidate = (
    e: MapMouseEvent | MapTouchEvent,
    mouseCoord?: Position,
    excludeIds?: string[],
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
      };
    }

    return null;
  };

  return {
    findSnappingCandidate,
  };
};
