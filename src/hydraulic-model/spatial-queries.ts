import { Feature, Polygon, Position } from "geojson";
import { AssetId } from "./asset-types";
import { AssetsGeoQueries } from "./assets-geo";
import bbox from "@turf/bbox";
import { polygon } from "@turf/helpers";
import booleanConcave from "@turf/boolean-concave";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import booleanContains from "@turf/boolean-contains";

export function queryContainedAssets(
  geoIndex: AssetsGeoQueries,
  searchOptions: SearchOptions,
): AssetId[] {
  const search = toSearchPolygon(searchOptions);
  const assetIds = geoIndex.searchNodes(search.bounds, (nodeId: AssetId) => {
    const nodeCoord = geoIndex.getNodePosition(nodeId);
    if (!nodeCoord) return false;
    return containsNode(search, nodeCoord);
  });
  const segmentIds = new Set(
    geoIndex.searchLinkSegments(search.bounds, (segmentId, segmentBounds) => {
      const segmentCoords = geoIndex.getSegmentCoords(segmentId);
      return containsSegment(search, segmentBounds, segmentCoords);
    }),
  );
  const segmentIdsAlreadyChecked = new Set<number>();

  for (const segmentId of segmentIds) {
    if (segmentIdsAlreadyChecked.has(segmentId)) continue;
    const linkId = geoIndex.getSegmentLinkId(segmentId);
    const linkSegmentIds = geoIndex.getLinkSegments(linkId);
    let areAllLinkSegmentsContained = true;
    for (const linkSegmentId of linkSegmentIds) {
      segmentIdsAlreadyChecked.add(linkSegmentId);
      if (!segmentIds.has(linkSegmentId)) areAllLinkSegmentsContained = false;
    }
    if (areAllLinkSegmentsContained) {
      assetIds.push(linkId);
    }
  }

  return assetIds;
}

type BoundingBox = [number, number, number, number];

type RadiusSearch = { position: Position; radiusInM: number };

type SearchOptions = BoundingBox | RadiusSearch | Position[];

function isAxisAlignedRectangle(polygonCoords: Position[]): boolean {
  if (polygonCoords.length !== 5) return false;

  const xs = new Set(polygonCoords.map((c) => c[0]));
  const ys = new Set(polygonCoords.map((c) => c[1]));
  return xs.size === 2 && ys.size === 2;
}

function isBboxContained(
  bbox: BoundingBox,
  containerBbox: BoundingBox,
): boolean {
  return (
    bbox[0] >= containerBbox[0] &&
    bbox[1] >= containerBbox[1] &&
    bbox[2] <= containerBbox[2] &&
    bbox[3] <= containerBbox[3]
  );
}

type SearchPolygon = BoundingBoxSearch | ClosedPolygon;
interface BoundingBoxSearch {
  bounds: BoundingBox;
  isBounds: true;
}
interface ClosedPolygon {
  bounds: BoundingBox;
  isBounds: false;
  polygon: Feature<Polygon>;
  isConvex: boolean;
}

function isBoundingBoxSearch(searchOptions: SearchOptions): boolean {
  return (
    Array.isArray(searchOptions) &&
    searchOptions.length === 4 &&
    typeof searchOptions[0] === "number"
  );
}

function isRadiusSearch(searchOptions: SearchOptions): boolean {
  return "position" in searchOptions && "radiusInM" in searchOptions;
}

function boundsFromPointAndRadius(search: RadiusSearch): BoundingBox {
  const { position, radiusInM } = search;
  const [lng, lat] = position;

  const deltaLat = radiusInM / 111_000;
  const deltaLng = radiusInM / (111_000 * Math.cos((lat * Math.PI) / 180));

  const minLng = lng - deltaLng;
  const maxLng = lng + deltaLng;
  const minLat = lat - deltaLat;
  const maxLat = lat + deltaLat;

  return [minLng, minLat, maxLng, maxLat];
}

export function toSearchPolygon(searchOptions: SearchOptions): SearchPolygon {
  if (isBoundingBoxSearch(searchOptions))
    return {
      bounds: searchOptions as BoundingBox,
      isBounds: true,
    };

  if (isRadiusSearch(searchOptions))
    return {
      bounds: boundsFromPointAndRadius(searchOptions as RadiusSearch),
      isBounds: true,
    };

  const polygonCoords = searchOptions as Position[];
  const tempPolygon = polygon([polygonCoords]);
  const polygonBounds = bbox(tempPolygon) as BoundingBox;

  if (isAxisAlignedRectangle(polygonCoords))
    return {
      isBounds: true,
      bounds: polygonBounds,
    };

  const polygonFeature = tempPolygon;
  return {
    isBounds: false,
    isConvex: !booleanConcave(polygonFeature),
    bounds: polygonBounds,
    polygon: polygonFeature,
  };
}

function containsNode(
  searchPolygon: SearchPolygon,
  nodeCoord: Position,
): boolean {
  if (searchPolygon.isBounds) return true;
  return booleanPointInPolygon(nodeCoord, searchPolygon.polygon);
}

function containsSegment(
  searchPolygon: SearchPolygon,
  segmentBounds: BoundingBox,
  segmentCoords: [Position, Position],
): boolean {
  if (!isBboxContained(segmentBounds, searchPolygon.bounds)) return false;

  if (searchPolygon.isBounds) return true;

  if (searchPolygon.isConvex)
    return segmentCoords.every((coord) =>
      booleanPointInPolygon(coord, searchPolygon.polygon),
    );

  const isAnyPointOutside = segmentCoords.some(
    (coord) => !booleanPointInPolygon(coord, searchPolygon.polygon),
  );
  if (isAnyPointOutside) return false;

  const segmentLine = {
    type: "LineString" as const,
    coordinates: segmentCoords,
  };
  return booleanContains(searchPolygon.polygon, {
    type: "Feature",
    properties: {},
    geometry: segmentLine,
  });
}
