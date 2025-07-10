import mapboxgl from "mapbox-gl";
import type { GeoJSONSourceRaw } from "mapbox-gl";
import type { MapHandlers, ClickEvent } from "../../types";
import { DataSource } from "src/map/data-source";
import { Feature } from "geojson";

class MapTestEngine {
  handlers: React.MutableRefObject<MapHandlers>;
  private sources: Map<string, GeoJSONSourceRaw> = new Map();
  private features: Map<string, any[]> = new Map();

  constructor({
    _element,
    handlers,
  }: {
    _element: HTMLDivElement;
    handlers: React.MutableRefObject<MapHandlers>;
  }) {
    this.handlers = handlers;
    this.sources.set("features", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    this.sources.set("imported-features", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    this.sources.set("icons", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    this.sources.set("ephemeral", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  map = {
    getSource: (name: string): GeoJSONSourceRaw | null =>
      this.sources.get(name) || null,
    on: vi.fn(),
    once: vi.fn(),
    addControl: vi.fn(),
    addImage: vi.fn(),
    hasImage: vi.fn().mockReturnValue(false),
    getCanvas: vi.fn().mockReturnValue({ style: { cursor: "" } }),
    setStyle: vi.fn(),
    getStyle: vi.fn().mockReturnValue({ layers: [] }),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    removeFeatureState: vi.fn(),
    setFeatureState: vi.fn(),
    setLayoutProperty: vi.fn(),
    getLayer: vi.fn(),
    queryRenderedFeatures: vi.fn().mockReturnValue([]),
    remove: vi.fn(),
    resize: vi.fn(),
    getCenter: vi.fn().mockReturnValue({ toArray: () => [0, 0] }),
    getBounds: vi.fn().mockReturnValue({
      toArray: () => [
        [-180, -90],
        [180, 90],
      ],
    }),
  };

  getSource(name: string): GeoJSONSourceRaw | null {
    return this.sources.get(name) || null;
  }

  setStyle() {
    return Promise.resolve();
  }
  addIcons() {
    return Promise.resolve();
  }

  setSource(name: DataSource, features: Feature[]): Promise<void> {
    const source = this.sources.get(name);
    if (source) {
      source.data = {
        type: "FeatureCollection",
        features,
      };
    }
    return Promise.resolve();
  }
  removeSource() {}
  showFeature() {}
  hideFeature() {}
  showLayers() {}
  hideLayers() {}
  showFeatures() {}
  hideFeatures() {}
  setOverlay() {}
  queryRenderedFeatures() {
    return [];
  }
  remove() {}
  selectFeature() {}
  unselectFeature() {}
  safeResize() {}
}

vi.mock("../../map-engine", () => {
  return {
    MapEngine: MapTestEngine,
  };
});

export const fireMapClick = (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
) => {
  map.handlers.current.onClick({
    lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
    point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100), // Mock point coordinates
    originalEvent: new MouseEvent("click"),
    target: map.map,
    type: "click",
    preventDefault: () => {},
    defaultPrevented: false,
  } as unknown as ClickEvent);
};

export const fireDoubleClick = (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
) => {
  map.handlers.current.onDoubleClick({
    lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
    point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100), // Mock point coordinates
    originalEvent: new MouseEvent("click"),
    target: map.map,
    type: "dblclick",
    preventDefault: () => {},
    defaultPrevented: false,
  } as unknown as ClickEvent);
};

export const fireMapMove = (
  map: MapTestEngine,
  movePoint: { lng: number; lat: number },
) => {
  map.handlers.current.onMapMouseMove({
    lngLat: new mapboxgl.LngLat(movePoint.lng, movePoint.lat),
    point: new mapboxgl.Point(movePoint.lng * 100, movePoint.lat * 100), // Mock point coordinates
    originalEvent: new MouseEvent("mousemove"),
    target: map.map,
    type: "mousemove",
    preventDefault: () => {},
    defaultPrevented: false,
  } as any);
};

export const getSourceFeatures = (
  map: MapTestEngine,
  sourceName: string,
): GeoJSON.Feature[] => {
  const source = map.getSource(sourceName);
  const featureCollection = source?.data as GeoJSON.FeatureCollection;
  return featureCollection.features;
};

export type { MapTestEngine };
