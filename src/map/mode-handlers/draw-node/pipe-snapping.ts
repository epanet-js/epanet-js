import type { MapEngine } from "../../map-engine";
import { Position } from "src/types";
import { decodeId } from "src/lib/id";
import { AssetsMap, LinkAsset } from "src/hydraulic-model";
import { searchNearbyRenderedFeatures } from "src/map/search";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";

type PipeSnapResult = {
  pipeId: number;
  snapPosition: Position;
};

export const usePipeSnapping = (map: MapEngine, assetsMap: AssetsMap) => {
  const findNearestPipeToSnap = (
    screenPoint: mapboxgl.Point,
    mouseCoord: Position,
  ): PipeSnapResult | null => {
    const pipeFeatures = searchNearbyRenderedFeatures(map, {
      point: screenPoint,
      layers: ["delta-features-pipes", "main-features-pipes"],
    });

    if (!pipeFeatures.length) return null;

    let closestPipe: {
      pipeId: number;
      snapPosition: Position;
      distance: number;
    } | null = null;

    for (const feature of pipeFeatures) {
      const id = feature.id;
      const decodedId = decodeId(id as RawId);
      const assetId = decodedId.featureId;
      if (!assetId) continue;

      const asset = assetsMap.get(assetId) as LinkAsset;
      if (!asset || !asset.isLink || asset.type !== "pipe") continue;

      const pipeGeometry = asset.feature.geometry;
      if (pipeGeometry.type !== "LineString") continue;

      const pipeLineString = lineString(pipeGeometry.coordinates);
      const mousePoint = point(mouseCoord);
      const result = findNearestPointOnLine(pipeLineString, mousePoint);

      const distance = result.distance ?? Number.MAX_VALUE;
      if (!closestPipe || distance < closestPipe.distance) {
        closestPipe = {
          pipeId: assetId,
          snapPosition: result.coordinates,
          distance: distance,
        };
      }
    }

    if (!closestPipe) return null;

    return {
      pipeId: closestPipe.pipeId,
      snapPosition: closestPipe.snapPosition,
    };
  };

  return {
    findNearestPipeToSnap,
  };
};
