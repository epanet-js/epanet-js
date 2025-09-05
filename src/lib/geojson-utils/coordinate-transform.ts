// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Projection } from "src/hooks/use-projections";

export function extractEPSGFromGeoJSON(geojson: any): {
  code: string | null;
  isCRS84: boolean;
} {
  try {
    const crsName: string | undefined = geojson?.crs?.properties?.name;
    if (!crsName || typeof crsName !== "string") {
      return { code: null, isCRS84: false };
    }

    if (
      crsName === "CRS84" ||
      /urn:ogc:def:crs:OGC:1\.3:CRS84/i.test(crsName)
    ) {
      return { code: "4326", isCRS84: true };
    }

    const urnMatch = crsName.match(/urn:ogc:def:crs:EPSG::(\d+)/i);
    if (urnMatch) {
      return { code: urnMatch[1], isCRS84: false };
    }

    const epsgMatch = crsName.match(/^EPSG:(\d+)$/i);
    if (epsgMatch) {
      return { code: epsgMatch[1], isCRS84: false };
    }

    return { code: null, isCRS84: false };
  } catch {
    return { code: null, isCRS84: false };
  }
}

export function findProjectionByCode(
  code: string,
  projections: Map<string, Projection>,
): Projection | null {
  if (!code) return null;
  const normalized = code.startsWith("EPSG:") ? code : `EPSG:${code}`;
  return projections.get(normalized) || null;
}

export function isLikelyLatLng(geojson: FeatureCollection | Feature): boolean {
  function isValidCoord(coord: [number, number]): boolean {
    const [lon, lat] = coord;
    return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
  }

  function checkGeometry(geometry: Geometry): boolean {
    if (!geometry) return false;

    switch (geometry.type) {
      case "Point":
        return isValidCoord(geometry.coordinates as [number, number]);
      case "MultiPoint":
      case "LineString":
        return (geometry.coordinates as [number, number][]).every(isValidCoord);
      case "MultiLineString":
      case "Polygon":
        return (geometry.coordinates as [number, number][][]).every((line) =>
          line.every(isValidCoord),
        );
      case "MultiPolygon":
        return (geometry.coordinates as [number, number][][][]).every(
          (polygon) => polygon.every((ring) => ring.every(isValidCoord)),
        );
      case "GeometryCollection":
        return geometry.geometries.every(checkGeometry);
      default:
        return false;
    }
  }

  if (geojson.type === "FeatureCollection") {
    return geojson.features.every(
      (feature) => feature.geometry && checkGeometry(feature.geometry),
    );
  } else if (geojson.type === "Feature") {
    return geojson.geometry ? checkGeometry(geojson.geometry) : false;
  }

  return false;
}

function convertGeometry(
  geometry: Geometry,
  sourceProjection: string,
): Geometry {
  const transformer = proj4(sourceProjection, "EPSG:4326");

  const transformCoords = (coords: any[]): any[] => {
    if (
      coords.length === 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      return transformer.forward(coords as [number, number]);
    }
    return coords.map(transformCoords);
  };

  const transformGeometry = (geom: Geometry): Geometry => {
    if (geom.type === "GeometryCollection") {
      return {
        type: "GeometryCollection",
        geometries: geom.geometries.map(transformGeometry),
      };
    } else {
      return {
        ...geom,
        coordinates: transformCoords(geom.coordinates),
      };
    }
  };

  return transformGeometry(geometry);
}

export function convertGeoJsonToWGS84(
  geojson: FeatureCollection,
  sourceProjection: string,
): FeatureCollection {
  return {
    ...geojson,
    features: geojson.features.map((feature: Feature) => {
      if (!feature.geometry) return feature;

      const convertedGeometry = convertGeometry(
        feature.geometry,
        sourceProjection,
      );

      return {
        ...feature,
        geometry: convertedGeometry,
      };
    }),
  };
}
