import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection, Feature, Position } from "geojson";
import { env } from "src/lib/env-client";
import { isLikelyLatLng } from "src/lib/geojson-utils/coordinate-transform";

const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 1;
const METERS_PER_DEGREE = 111_320;

const EMPTY_STYLE: mapboxgl.Style = {
  version: 8,
  name: "Empty",
  sprite: "mapbox://sprites/mapbox/streets-v8",
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#F5F5F5" },
    },
  ],
};

export type MapPreviewHandle = {
  fitBounds: (bbox: [number, number, number, number]) => void;
};

export const MapPreview = forwardRef<
  MapPreviewHandle,
  { geoJSON: FeatureCollection }
>(function MapPreview({ geoJSON }, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const displayGeoJSON = useMemo(
    () =>
      isLikelyLatLng(geoJSON) ? geoJSON : approximateToNullIsland(geoJSON),
    [geoJSON],
  );

  useImperativeHandle(ref, () => ({
    fitBounds: (bbox) => {
      mapRef.current?.fitBounds(bbox, { padding: 50, animate: false });
    },
  }));

  const initMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    mapRef.current?.remove();

    mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: EMPTY_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      boxZoom: false,
      dragRotate: false,
      doubleClickZoom: false,
    });

    map.on("load", () => {
      map.resize();

      map.addSource("network", {
        type: "geojson",
        data: displayGeoJSON,
      });

      map.addLayer({
        id: "network-lines",
        type: "line",
        source: "network",
        filter: ["==", "$type", "LineString"],
        paint: {
          "line-color": "#3b82f6",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
        },
      });

      map.addLayer({
        id: "network-points",
        type: "circle",
        source: "network",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            0.5,
            16,
            5,
          ],
          "circle-color": "#3b82f6",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0.5,
            16,
            1,
          ],
          "circle-stroke-color": "#ffffff",
        },
        minzoom: 13,
      });

      const bounds = computeBounds(displayGeoJSON);
      if (bounds) {
        map.fitBounds(bounds, { padding: 50, duration: 0 });
      }
    });

    mapRef.current = map;
  }, [displayGeoJSON]);

  useEffect(() => {
    initMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div ref={mapContainerRef} className="flex-1 w-full" />
    </div>
  );
});

function computeBounds(
  geoJSON: FeatureCollection,
): mapboxgl.LngLatBoundsLike | null {
  const coords: [number, number][] = [];

  for (const feature of geoJSON.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "Point") {
      coords.push(feature.geometry.coordinates as [number, number]);
    } else if (feature.geometry.type === "LineString") {
      coords.push(...(feature.geometry.coordinates as [number, number][]));
    }
  }

  if (coords.length === 0) return null;

  const bounds = coords.reduce(
    (b, coord) => b.extend(coord as mapboxgl.LngLatLike),
    new mapboxgl.LngLatBounds(coords[0], coords[0]),
  );

  return bounds;
}

function approximateToNullIsland(
  geoJSON: FeatureCollection,
): FeatureCollection {
  let minX = Infinity;
  let minY = Infinity;

  const extractCoords = (coords: Position) => {
    if (coords[0] < minX) minX = coords[0];
    if (coords[1] < minY) minY = coords[1];
  };

  for (const feature of geoJSON.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "Point") {
      extractCoords(feature.geometry.coordinates);
    } else if (feature.geometry.type === "LineString") {
      feature.geometry.coordinates.forEach(extractCoords);
    }
  }

  const transform = (coord: Position): Position => [
    (coord[0] - minX) / METERS_PER_DEGREE,
    (coord[1] - minY) / METERS_PER_DEGREE,
  ];

  return {
    ...geoJSON,
    features: geoJSON.features.map((feature: Feature) => {
      if (!feature.geometry) return feature;
      if (feature.geometry.type === "Point") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: transform(feature.geometry.coordinates),
          },
        };
      }
      if (feature.geometry.type === "LineString") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map(transform),
          },
        };
      }
      return feature;
    }),
  };
}
