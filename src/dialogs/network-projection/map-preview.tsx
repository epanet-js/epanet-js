import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection } from "geojson";
import { env } from "src/lib/env-client";
import { emptyFeatureCollection } from "src/lib/constants";
import {
  CustomMapControl,
  FIT_TO_EXTENT_ICON,
} from "src/map/custom-map-control";
import type { Bbox } from "./types";
import type { MapPreviewHandle } from "./use-map-preview";
import { useTranslate } from "src/hooks/use-translate";

const BASEMAP_STYLE = "mapbox://styles/mapbox/light-v10";

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

const NETWORK_LAYERS: mapboxgl.AnyLayer[] = [
  {
    id: "network-lines",
    type: "line",
    source: "network",
    filter: ["==", "$type", "LineString"],
    paint: {
      "line-color": "#3b82f6",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
    },
  },
  {
    id: "network-points",
    type: "circle",
    source: "network",
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 5],
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
  },
];

type MapPreviewProps = {
  geoJSON: FeatureCollection | null;
  showBasemap: boolean;
  onBoundsChange?: (bounds: Bbox) => void;
  isLoading?: boolean;
  setHandle: (handle: MapPreviewHandle | null) => void;
};

export const MapPreview = ({
  geoJSON,
  showBasemap,
  onBoundsChange,
  isLoading,
  setHandle,
}: MapPreviewProps) => {
  const t = useTranslate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const programmaticMoveRef = useRef(false);
  const geoJSONRef = useRef(geoJSON);
  geoJSONRef.current = geoJSON;
  const pendingDataUpdateRef = useRef(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: EMPTY_STYLE,
      center: [0, 0],
      zoom: 1,
      attributionControl: false,
      boxZoom: false,
      dragRotate: false,
      doubleClickZoom: false,
    });

    map.addControl(new mapboxgl.NavigationControl({}), "bottom-right");
    map.addControl(
      new CustomMapControl(
        {
          name: "fit-to-extent",
          title: t("networkProjection.fitToExtent"),
          icon: FIT_TO_EXTENT_ICON,
        },
        () => {
          const data = geoJSONRef.current;
          if (data && data.features.length > 0) {
            fitToGeoJSON(map, data);
          }
        },
      ),
      "bottom-right",
    );

    map.on("load", () => {
      styleReadyRef.current = true;
      addNetworkSourceAndLayers(map, geoJSONRef.current);
      programmaticFit(map, geoJSONRef.current, null);
    });

    map.on("moveend", () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        return;
      }
      if (!onBoundsChangeRef.current) return;
      const b = map.getBounds();
      onBoundsChangeRef.current([
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ]);
    });

    mapRef.current = map;

    setHandle({
      fitToNetwork: (geoJSON: FeatureCollection) => {
        if (!styleReadyRef.current) return;
        if (geoJSON.features.length > 0) {
          programmaticFit(map, geoJSON, null);
        }
      },
      fitToBbox: (bbox: Bbox) => {
        if (!styleReadyRef.current) return;
        programmaticFit(map, null, bbox);
      },
    });

    return () => {
      setHandle(null);
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const currentIsBasemap =
      typeof map.getStyle().name === "string" &&
      map.getStyle().name !== "Empty";
    if (showBasemap && !currentIsBasemap) {
      styleReadyRef.current = false;
      map.setStyle(BASEMAP_STYLE);
      map.once("style.load", () => {
        styleReadyRef.current = true;
        addNetworkSourceAndLayers(map, geoJSONRef.current);
        programmaticFit(map, geoJSONRef.current, null);
        pendingDataUpdateRef.current = false;
      });
    } else if (!showBasemap && currentIsBasemap) {
      styleReadyRef.current = false;
      map.setStyle(EMPTY_STYLE);
      map.once("style.load", () => {
        styleReadyRef.current = true;
        addNetworkSourceAndLayers(map, geoJSONRef.current);
        programmaticFit(map, geoJSONRef.current, null);
        pendingDataUpdateRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBasemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!styleReadyRef.current) {
      pendingDataUpdateRef.current = true;
      return;
    }

    const source = map.getSource("network") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(geoJSON ?? emptyFeatureCollection);
    }
  }, [geoJSON]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div ref={mapContainerRef} className="flex-1 w-full" />
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-black/30 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );

  function programmaticFit(
    map: mapboxgl.Map,
    geoJSON: FeatureCollection | null,
    bbox: Bbox | null,
  ) {
    programmaticMoveRef.current = true;

    if (bbox) {
      map.fitBounds(bbox, { padding: 50, duration: 0 });
      return;
    }

    if (!geoJSON || geoJSON.features.length === 0) {
      programmaticMoveRef.current = false;
      return;
    }

    fitToGeoJSON(map, geoJSON);
  }
};

function fitToGeoJSON(map: mapboxgl.Map, geoJSON: FeatureCollection) {
  const coords: [number, number][] = [];
  for (const feature of geoJSON.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "Point") {
      coords.push(feature.geometry.coordinates as [number, number]);
    } else if (feature.geometry.type === "LineString") {
      coords.push(...(feature.geometry.coordinates as [number, number][]));
    }
  }

  if (coords.length === 0) return;

  const bounds = coords.reduce(
    (b, coord) => b.extend(coord as mapboxgl.LngLatLike),
    new mapboxgl.LngLatBounds(coords[0], coords[0]),
  );

  map.fitBounds(bounds, { padding: 50, duration: 0 });
}

function addNetworkSourceAndLayers(
  map: mapboxgl.Map,
  geoJSON: FeatureCollection | null,
) {
  if (map.getSource("network")) return;

  map.addSource("network", {
    type: "geojson",
    data: geoJSON ?? emptyFeatureCollection,
  });

  for (const layer of NETWORK_LAYERS) {
    map.addLayer(layer);
  }
}
