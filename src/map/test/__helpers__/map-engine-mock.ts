import mapboxgl from "mapbox-gl";
import type { GeoJSONSourceRaw } from "mapbox-gl";
import type { MapHandlers, ClickEvent } from "../../types";

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
  setSource() {
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
    originalEvent: new MouseEvent("click"),
    target: map.map,
    type: "click",
    preventDefault: () => {},
    defaultPrevented: false,
  } as unknown as ClickEvent);
};

export type { MapTestEngine };
