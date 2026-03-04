import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { env } from "src/lib/env-client";
import type { PreviewPoint } from "./use-converter";

const DEFAULT_CENTER: [number, number] = [-4.3800042, 55.914314];
const DEFAULT_ZOOM = 4;
const NETWORK_SOURCE_ID = "projection-converter-network";
const NETWORK_LAYER_ID = "projection-converter-network-points";

type GeocoderResult = {
  name: string;
  center: [number, number];
  bbox?: [number, number, number, number]; // [west, south, east, north]
};

async function searchPlaces(
  query: string,
  signal: AbortSignal,
): Promise<GeocoderResult[]> {
  const token = env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const encoded = encodeURIComponent(query);
  const resp = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
      `?access_token=${token}&limit=5&types=place,locality,region,country,district`,
    { signal },
  );
  type RawFeature = {
    place_name: string;
    center: [number, number];
    bbox?: [number, number, number, number];
  };
  const data = (await resp.json()) as { features?: RawFeature[] };
  return (data.features ?? []).map((f) => ({
    name: f.place_name,
    center: f.center,
    bbox: f.bbox,
  }));
}

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export function ProjectionMap({
  previewPoints,
  onZoomChange,
  onBoundsChange,
}: {
  previewPoints: PreviewPoint[];
  onZoomChange: (zoom: number) => void;
  onBoundsChange: (bounds: MapBounds) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocoderResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v10",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const emitState = () => {
      const b = map.getBounds();
      onZoomChange(map.getZoom());
      onBoundsChange({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      });
    };

    map.on("load", () => {
      // Add empty GeoJSON source for network preview
      map.addSource(NETWORK_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: NETWORK_LAYER_ID,
        type: "circle",
        source: NETWORK_SOURCE_ID,
        paint: {
          "circle-radius": 4,
          "circle-color": "#7c3aed",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Emit initial state with default center immediately
      emitState();

      // Then try to improve with native geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.easeTo({
              center: [pos.coords.longitude, pos.coords.latitude],
              zoom: 8,
            });
            // moveend will fire emitState after easeTo completes
          },
          () => {
            // keep default center — already emitted above
          },
          { timeout: 5000 },
        );
      }
    });

    map.on("zoomend", emitState);
    map.on("moveend", emitState);

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update network preview layer when previewPoints change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(NETWORK_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: previewPoints.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { name: p.name },
      })),
    });

    if (previewPoints.length > 0) {
      // Remove search pin when network preview appears
      markerRef.current?.remove();
      markerRef.current = null;

      const bounds = previewPoints.reduce(
        (b, p) => b.extend([p.lng, p.lat]),
        new mapboxgl.LngLatBounds(
          [previewPoints[0].lng, previewPoints[0].lat],
          [previewPoints[0].lng, previewPoints[0].lat],
        ),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 500 });
    }
  }, [previewPoints]);

  const handleSearchInput = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const results = await searchPlaces(query, controller.signal);
      setSearchResults(results);
      setShowResults(true);
    } catch {
      // aborted or failed — ignore
    }
  }, []);

  const handleSelectResult = useCallback((result: GeocoderResult) => {
    const map = mapRef.current;
    if (!map) return;

    // Place/move a purple pin at the result center
    if (markerRef.current) {
      markerRef.current.setLngLat(result.center);
    } else {
      markerRef.current = new mapboxgl.Marker({ color: "#7c3aed" })
        .setLngLat(result.center)
        .addTo(map);
    }

    // Fly to result
    if (result.bbox) {
      const [west, south, east, north] = result.bbox;
      map.fitBounds([west, south, east, north], { padding: 60, maxZoom: 14 });
    } else {
      map.flyTo({ center: result.center, zoom: Math.max(map.getZoom(), 10) });
    }

    setSearchQuery(result.name);
    setShowResults(false);
  }, []);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* Geocoder search overlay */}
      <div className="absolute top-3 left-3 z-10 w-72">
        <input
          type="search"
          placeholder="Search for a place…"
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          className="w-full px-3 py-2 text-sm rounded-lg shadow-md border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          data-capture-escape-key
        />
        {showResults && searchResults.length > 0 && (
          <ul className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {searchResults.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-800"
                  onMouseDown={() => handleSelectResult(r)}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map container */}
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  );
}
