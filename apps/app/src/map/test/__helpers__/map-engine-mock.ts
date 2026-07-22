import mapboxgl from "mapbox-gl";
import type { GeoJSONSourceRaw, PointLike } from "mapbox-gl";
import type { MapHandlers, ClickEvent } from "../../types";
import { DataSource } from "src/map/data-source";
import { Feature } from "geojson";
import { vi } from "vitest";
import { act } from "react";

// Run a map interaction and let the resulting work settle, all inside act():
// the synchronous invocation, the React renders/effects it triggers, and the
// map-sync timers (which run on setTimeout and update React state) all complete
// within the act() boundary. This keeps handlers.current fresh for the next
// action and prevents any state update from escaping act() and warning.
const settle = async (invoke: () => void, ms: number = 0): Promise<void> => {
  await act(async () => {
    invoke();
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

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
    this.sources.set("delta-features", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    this.sources.set("main-features", {
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
    removeFeatureState: (
      source: { source: string; id?: string },
      key?: string,
    ) => {
      const sourceStates = this.featureStates.get(source.source);
      if (!sourceStates) return;

      if (source.id) {
        if (key) {
          const featureState = sourceStates.get(source.id) || {};
          delete featureState[key];
          sourceStates.set(source.id, featureState);
        } else {
          sourceStates.delete(source.id);
        }
      } else {
        sourceStates.clear();
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
    project: vi.fn().mockImplementation((lngLat: [number, number]) => ({
      x: lngLat[0] * 100,
      y: lngLat[1] * 100,
    })),
    getZoom: vi.fn().mockReturnValue(18),
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

  setSource(name: DataSource, features: Feature[]): void {
    const source = this.sources.get(name);
    if (source) {
      source.data = {
        type: "FeatureCollection",
        features,
      };
    }
  }
  onNextIdle(callback: (settledCleanly: boolean) => void): void {
    callback(false);
  }
  removeSource() {}
  showFeature(sourceName: DataSource, featureId: string) {
    this.map.removeFeatureState(
      { source: sourceName, id: featureId },
      "hidden",
    );
  }
  hideFeature(sourceName: DataSource, featureId: string) {
    this.map.setFeatureState(
      { source: sourceName, id: featureId },
      { hidden: true },
    );
  }
  getPrecision(): number {
    return 7;
  }
  suspendOverlayStyleReactions() {}
  resumeOverlayStyleReactions() {}
  addLayer() {}
  setLayerPaintRule() {}
  setLayerMinZoom() {}
  showLayers() {}
  hideLayers() {}
  showFeatures() {}
  hideFeatures() {}
  setOverlay() {}
  isStyleLoaded(): boolean {
    return true;
  }
  clearFeatureState(sourceName: DataSource): void {
    this.map.removeFeatureState({ source: sourceName });
  }

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

  getFeatureState(source: DataSource, featureId: string): FeatureState {
    return this.map.getFeatureState({ source, id: featureId });
  }

  isFeatureHidden(source: DataSource, featureId: string): boolean {
    const featureState = this.getFeatureState(source, featureId);
    return featureState.hidden === true;
  }

  safeResize() {}
}

vi.mock("../../map-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../map-engine")>();
  return {
    ...actual,
    MapEngine: MapTestEngine,
  };
});

export const fireMapDown = async (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): Promise<void> => {
  await settle(() => fireMapDownSync(map, clickPoint), 10);
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

export const fireMapUp = async (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): Promise<void> => {
  await settle(() => fireMapUpSync(map, clickPoint), 10);
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
  await settle(() => {
    fireMapDownSync(map, clickPoint);
    fireMapUpSync(map, clickPoint);
    map.handlers.current.onClick({
      lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
      point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100), // Mock point coordinates
      originalEvent: new MouseEvent("click"),
      target: map.map,
      type: "click",
      preventDefault: () => {},
      defaultPrevented: false,
    } as unknown as ClickEvent);
  }, 10);
};

export const fireDoubleClick = async (
  map: MapTestEngine,
  clickPoint: { lng: number; lat: number },
): Promise<void> => {
  await settle(() => {
    map.handlers.current.onDoubleClick({
      lngLat: new mapboxgl.LngLat(clickPoint.lng, clickPoint.lat),
      point: new mapboxgl.Point(clickPoint.lng * 100, clickPoint.lat * 100), // Mock point coordinates
      originalEvent: new MouseEvent("click"),
      target: map.map,
      type: "dblclick",
      preventDefault: () => {},
      defaultPrevented: false,
    } as unknown as ClickEvent);
  }, 10);
};

export const fireMapMove = async (
  map: MapTestEngine,
  movePoint: { lng: number; lat: number },
): Promise<void> => {
  await settle(() => fireMapMoveSync(map, movePoint), 0);
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
