import { IDMap, UIDMap } from "src/lib/id-mapper";
import type { MapEngine } from "../../map-engine";
import { Position } from "src/types";
import { decodeId } from "src/lib/id";
import { AssetsMap, LinkAsset } from "src/hydraulic-model";
import { searchNearbyRenderedFeatures } from "src/map/search";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString, point } from "@turf/helpers";
import { CustomerPoint } from "src/hydraulic-model/customer-points";

type PipeSnapResult = {
  pipeId: string;
};

export const usePipeSnapping = (
  map: MapEngine,
  idMap: IDMap,
  assetsMap: AssetsMap,
) => {
  const findNearestPipe = (
    screenPoint: mapboxgl.Point,
    mouseCoord: Position,
  ): PipeSnapResult | null => {
    const pipeFeatures = searchNearbyRenderedFeatures(map, {
      point: screenPoint,
      distance: 20,
      layers: ["pipes", "imported-pipes"],
    });

    if (!pipeFeatures.length) return null;

    let closestPipe: {
      pipeId: string;
      distance: number;
    } | null = null;

    for (const feature of pipeFeatures) {
      const id = feature.id;
      const decodedId = decodeId(id as RawId);
      const uuid = UIDMap.getUUID(idMap, decodedId.featureId);
      if (!uuid) continue;

      const asset = assetsMap.get(uuid) as LinkAsset;
      if (!asset || !asset.isLink || asset.type !== "pipe") continue;

      const pipeGeometry = asset.feature.geometry;
      if (pipeGeometry.type !== "LineString") continue;

      const pipeLineString = lineString(pipeGeometry.coordinates);
      const mousePoint = point(mouseCoord);
      const nearestPoint = nearestPointOnLine(pipeLineString, mousePoint);

      const distance = nearestPoint.properties.dist ?? Number.MAX_VALUE;
      if (!closestPipe || distance < closestPipe.distance) {
        closestPipe = {
          pipeId: uuid,
          distance: distance,
        };
      }
    }

    if (!closestPipe) return null;

    return {
      pipeId: closestPipe.pipeId,
    };
  };

  const calculateSnapPoints = (
    customerPoints: CustomerPoint[],
    pipeId: string,
  ): Position[] => {
    const pipe = assetsMap.get(pipeId) as LinkAsset;
    if (!pipe || !pipe.isLink || pipe.type !== "pipe") return [];

    const pipeGeometry = pipe.feature.geometry;
    if (pipeGeometry.type !== "LineString") return [];

    const pipeLineString = lineString(pipeGeometry.coordinates);

    return customerPoints.map((customerPoint) => {
      const customerPointGeometry = point(customerPoint.coordinates);
      const nearestPoint = nearestPointOnLine(
        pipeLineString,
        customerPointGeometry,
      );
      return nearestPoint.geometry.coordinates;
    });
  };

  return {
    findNearestPipe,
    calculateSnapPoints,
  };
};
