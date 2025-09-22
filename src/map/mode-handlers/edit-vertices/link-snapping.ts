import { IDMap, UIDMap } from "src/lib/id-mapper";
import type { MapEngine } from "../../map-engine";
import { Position } from "src/types";
import { decodeId } from "src/lib/id";
import { AssetsMap, LinkAsset } from "src/hydraulic-model";
import { searchNearbyRenderedFeatures } from "src/map/search";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";

type LinkSnapResult = {
  linkId: string;
  snapPosition: Position;
};

export const useLinkSnapping = (
  map: MapEngine,
  idMap: IDMap,
  assetsMap: AssetsMap,
) => {
  const findNearestLinkToSnap = (
    screenPoint: mapboxgl.Point,
    mouseCoord: Position,
    targetLinkId?: string,
  ): LinkSnapResult | null => {
    const linkFeatures = searchNearbyRenderedFeatures(map, {
      point: screenPoint,
      layers: [
        "pipes",
        "imported-pipes",
        "pump-lines",
        "imported-pump-lines",
        "valve-lines",
        "imported-valve-lines",
      ],
    });

    if (!linkFeatures.length) return null;

    let closestLink: {
      linkId: string;
      snapPosition: Position;
      distance: number;
    } | null = null;

    for (const feature of linkFeatures) {
      const id = feature.id;
      const decodedId = decodeId(id as RawId);
      const uuid = UIDMap.getUUID(idMap, decodedId.featureId);
      if (!uuid) continue;

      if (targetLinkId && uuid !== targetLinkId) continue;

      const asset = assetsMap.get(uuid) as LinkAsset;
      if (!asset || !asset.isLink) continue;

      const linkGeometry = asset.feature.geometry;
      if (linkGeometry.type !== "LineString") continue;

      const linkLineString = lineString(linkGeometry.coordinates);
      const mousePoint = point(mouseCoord);
      const result = findNearestPointOnLine(linkLineString, mousePoint);

      const distance = result.distance ?? Number.MAX_VALUE;
      if (!closestLink || distance < closestLink.distance) {
        closestLink = {
          linkId: uuid,
          snapPosition: result.coordinates,
          distance: distance,
        };
      }
    }

    if (!closestLink) return null;

    return {
      linkId: closestLink.linkId,
      snapPosition: closestLink.snapPosition,
    };
  };

  return {
    findNearestLinkToSnap,
  };
};
