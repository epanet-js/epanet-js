import { IDMap, UIDMap } from "src/lib/id-mapper";
import type { MapEngine } from "../../map-engine";
import { Position } from "src/types";
import { decodeId } from "src/lib/id";
import { AssetsMap, LinkAsset } from "src/hydraulic-model";
import { searchNearbyRenderedFeatures } from "src/map/search";
import { lineString, point } from "@turf/helpers";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { findNearestPointOnLine } from "src/lib/geometry";

type SnapStrategy = "nearest-to-point" | "cursor";

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
      const result = findNearestPointOnLine(pipeLineString, mousePoint);

      const distance = result.distance ?? Number.MAX_VALUE;
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
    strategy: SnapStrategy,
    mouseCoord: Position,
  ): Position[] => {
    const pipe = assetsMap.get(pipeId) as LinkAsset;
    if (!pipe || !pipe.isLink || pipe.type !== "pipe") return [];

    const pipeGeometry = pipe.feature.geometry;
    if (pipeGeometry.type !== "LineString") return [];

    const pipeLineString = lineString(pipeGeometry.coordinates);

    switch (strategy) {
      case "cursor": {
        const mousePoint = point(mouseCoord);
        const result = findNearestPointOnLine(pipeLineString, mousePoint);
        const snapPoint = result.coordinates;
        return customerPoints.map(() => snapPoint);
      }
      case "nearest-to-point": {
        return customerPoints.map((customerPoint) => {
          const customerPointGeometry = point(customerPoint.coordinates);
          const result = findNearestPointOnLine(
            pipeLineString,
            customerPointGeometry,
          );
          return result.coordinates;
        });
      }
    }
  };

  return {
    findNearestPipe,
    calculateSnapPoints,
  };
};
