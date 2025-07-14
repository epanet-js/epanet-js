import mapboxgl from "mapbox-gl";
import type { GeoJSONSourceRaw, PointLike } from "mapbox-gl";
import type { MapHandlers, ClickEvent } from "../../types";
import { DataSource } from "src/map/data-source";
import { Feature } from "geojson";
import { vi } from "vitest";

type FeatureState = Record<string, string | boolean | number>;

class MapTestEngine {
  handlers: React.MutableRefObject<MapHandlers>;
  private sources: Map<string, GeoJSONSourceRaw> = new Map();
  private features: Map<string, any[]> = new Map();
  private featureStates: Map<string, Map<string, FeatureState>> = new Map();

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
    removeFeatureState: (source: { source: string; id: string }) => {
      const sourceStates = this.featureStates.get(source.source);
      if (sourceStates) {
        sourceStates.delete(source.id);
      }
    },
    setFeatureState: (
      source: { source: string; id: string },
      state: FeatureState,
    ) => {
      if (!this.featureStates.has(source.source)) {
        this.featureStates.set(source.source, new Map());
      }
      this.featureStates.get(source.source)!.set(source.id, state);
    },
    getFeatureState: (source: { source: string; id: string }): FeatureState => {
      const sourceStates = this.featureStates.get(source.source);
      return sourceStates?.get(source.id) || {};
    },
    setLayoutProperty: vi.fn(),
    getLayer: vi.fn(),
    queryRenderedFeatures: vi.fn(),
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

  queryRenderedFeatures(
    _pointOrBox?: PointLike | [PointLike, PointLike],
    _options?: { layers?: string[] },
  ): Feature[] {
    return this.map.queryRenderedFeatures(_pointOrBox, _options) as Feature[];
  }

  searchNearbyRenderedFeatures({
    point,
    distance = 12,
    layers,
  }: {
    point: mapboxgl.Point;
    distance?: number;
    layers: string[];
  }): Feature[] {
    const { x, y } = point;

    const searchBox = [
      [x - distance, y - distance] as PointLike,
      [x + distance, y + distance] as PointLike,
    ] as [PointLike, PointLike];

    return this.queryRenderedFeatures(searchBox, { layers });
  }

  remove() {}
  selectFeature(sourceName: string, featureId: string) {
    this.map.setFeatureState(
      { source: sourceName, id: featureId },
      { selected: "true" },
    );
  }
  unselectFeature(sourceName: string, featureId: string) {
    this.map.setFeatureState(
      { source: sourceName, id: featureId },
      { selected: "false" },
    );
  }
  safeResize() {}
}

vi.mock("../../map-engine", () => {
  return {
    MapEngine: MapTestEngine,
    DEFAULT_ZOOM: 15.5,
  };
});

export const fireMapDown = (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): Promise<void> => {
  fireMapDownSync(map, clickPoint);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 10); // Small delay to allow React state updates
  });
};

export const fireMapDownSync = (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): void => {
  map.handlers.current.onMapMouseDown({
    lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
    point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100),
    originalEvent: new MouseEvent("mousedown"),
    target: map.map,
    type: "mousedown",
    preventDefault: () => {},
    defaultPrevented: false,
  } as unknown as mapboxgl.MapMouseEvent);
};

export const fireMapUp = (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): Promise<void> => {
  fireMapUpSync(map, clickPoint);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 10); // Small delay to allow React state updates
  });
};

export const fireMapUpSync = (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): void => {
  map.handlers.current.onMapMouseUp({
    lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
    point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100),
    originalEvent: new MouseEvent("mouseup"),
    target: map.map,
    type: "mouseup",
    preventDefault: () => {},
    defaultPrevented: false,
  } as unknown as mapboxgl.MapMouseEvent);
};

export const fireMapClick = async (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): Promise<void> => {
  await fireMapDown(map, clickPoint);
  await fireMapUp(map, clickPoint);

  map.handlers.current.onClick({
    lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
    point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100), // Mock point coordinates
    originalEvent: new MouseEvent("click"),
    target: map.map,
    type: "click",
    preventDefault: () => {},
    defaultPrevented: false,
  } as unknown as ClickEvent);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 10); // Small delay to allow React state updates
  });
};

export const fireDoubleClick = (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): Promise<void> => {
  map.handlers.current.onDoubleClick({
    lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
    point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100), // Mock point coordinates
    originalEvent: new MouseEvent("click"),
    target: map.map,
    type: "dblclick",
    preventDefault: () => {},
    defaultPrevented: false,
  } as unknown as ClickEvent);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 0);
  });
};

export const fireMapMove = (
  map: MapTestEngine,
  movePoint: { lng: number; lat: number },
): Promise<void> => {
  fireMapMoveSync(map, movePoint);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 0);
  });
};

export const fireMapMoveSync = (
  map: MapTestEngine,
  movePoint: { lng: number; lat: number },
): void => {
  map.handlers.current.onMapMouseMove({
    lngLat: new mapboxgl.LngLat(movePoint.lng, movePoint.lat),
    point: new mapboxgl.Point(movePoint.lng * 100, movePoint.lat * 100),
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

export const stubNoSnapping = (map: MapTestEngine) => {
  vi.mocked(map.map.queryRenderedFeatures).mockReturnValue([]);
};

export const stubSnapping = (map: MapTestEngine, featureIds: number[]) => {
  vi.mocked(map.map.queryRenderedFeatures).mockReturnValue(
    featureIds.map((id) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      id,
    })),
  );
};

export const stubSnappingOnce = (map: MapTestEngine, featureIds: number[]) => {
  vi.mocked(map.map.queryRenderedFeatures)
    .mockReturnValueOnce(
      featureIds.map((id) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        id,
      })),
    )
    .mockReturnValue([]);
};

export const getFeatureState = (
  map: MapTestEngine,
  sourceName: string,
  featureId: RawId,
): FeatureState => {
  return map.map.getFeatureState({
    source: sourceName,
    id: featureId as unknown as string,
  });
};

export type { MapTestEngine };
