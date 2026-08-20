import mapboxgl, { Style } from "mapbox-gl";
import type { Map as MapboxMap, MapboxGeoJSONFeature } from "mapbox-gl";

import type { Feature, FeatureCollection, Geometry } from "geojson";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { LayersList } from "@deck.gl/core";
import { precisionForZoom } from "@epanet-js/geometry";
import type { MapHandlers, MoveEvent } from "./types";
import {
  CustomMapControl,
  CustomMapControlClick,
  FIT_TO_EXTENT_CONTROL,
  FIT_TO_EXTENT_ICON,
} from "./custom-map-control";
import { SourceTypeMismatchError } from "./errors";

// Empty string resets the canvas cursor to the browser default (clears any inline
// cursor style). Duplicated here so the engine doesn't depend on the app's constants.
const CURSOR_DEFAULT = "";

// Feature id as mapbox uses it. Inlined so the engine needs no app-global types.
type RawId = number;

// A mutable ref holding the current handlers — structurally a React ref, but typed
// without a React dependency (the app passes its useRef result, which matches).
type HandlersRef = { current: MapHandlers };

// A prepared sprite image to register on the map. Inlined (id as a plain string) so
// the engine doesn't depend on the icons module; the caller prepares the sprite and
// passes it to addIcons.
export type IconImage = {
  id: string;
  image: HTMLImageElement;
  isSdf?: boolean;
};

export const DEFAULT_ZOOM = 15.5;
export const DEFAULT_CENTER: [number, number] = [-4.3800042, 55.914314];

export const MAP_MIN_ZOOM = 0;
export const MAP_MAX_ZOOM = 26;

// Mapbox style spec caps a layer's zoom range at 24, regardless of the map's
// own maxZoom.
export const LAYER_MAX_ZOOM = 24;

export type InitialViewport = {
  center: [number, number];
  zoom: number;
};

const MAP_OPTIONS: Omit<mapboxgl.MapboxOptions, "container"> = {
  style: { version: 8, layers: [], sources: {} },
  maxZoom: MAP_MAX_ZOOM,
  boxZoom: false,
  dragRotate: false,
  attributionControl: false,
  fadeDuration: 0,
  antialias: true,
  doubleClickZoom: false,
  preserveDrawingBuffer: true,
};

// Backstop for a map that never reaches idle. Reset on every re-arm, so an
// active stream of updates keeps pushing it back.
const IDLE_TIMEOUT_MS = 10000;

/**
 * Memoizes a value across calls. The compute function only re-runs when one of
 * its declared dependencies changes (compared with `Object.is`). Inspired by
 * TanStack Table's `memo`.
 */
const memo = <const TDeps extends readonly unknown[], TResult>(
  getDeps: () => TDeps,
  compute: (...deps: TDeps) => TResult,
): (() => TResult) => {
  let last: { deps: readonly unknown[]; result: TResult } | undefined;
  return () => {
    const deps = getDeps();
    if (
      last &&
      last.deps.length === deps.length &&
      last.deps.every((d, i) => Object.is(d, deps[i]))
    ) {
      return last.result;
    }
    const result = compute(...deps);
    last = { deps, result };
    return result;
  };
};

/**
 * Lowest zoom that keeps the map's center inside the Mercator projection's
 * vertical bounds.
 */
export const computeSameCenterMinZoom = (
  containerHeight: number,
  latitude: number,
  maxZoom: number,
): number => {
  const TILE_SIZE_AT_ZOOM_0 = 512;
  // Web Mercator Y for the latitude, normalized to [0, 1] (0 ≈ 85°N, 1 ≈ 85°S).
  const phi = (latitude * Math.PI) / 180;
  const mercY = 0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI);

  const distanceFromBound = Math.min(mercY, 1 - mercY);
  if (distanceFromBound <= 0) return maxZoom;
  return Math.min(
    maxZoom,
    Math.log2(containerHeight / (2 * TILE_SIZE_AT_ZOOM_0 * distanceFromBound)),
  );
};

export class MapEngine {
  map: mapboxgl.Map;
  handlers: HandlersRef;
  overlay: MapboxOverlay;
  private idleCallback: ((settledCleanly: boolean) => void) | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleDisturbed = false;

  constructor({
    element,
    handlers,
    onControlClick,
    initialViewport,
  }: {
    element: HTMLDivElement;
    handlers: HandlersRef;
    onControlClick: (event: CustomMapControlClick) => void;
    initialViewport?: InitialViewport;
  }) {
    const defaultStart = {
      center: (initialViewport?.center ??
        DEFAULT_CENTER) as mapboxgl.LngLatLike,
      zoom: initialViewport?.zoom ?? DEFAULT_ZOOM,
    };

    const map = new mapboxgl.Map({
      container: element,
      ...MAP_OPTIONS,
      ...defaultStart,
    });

    this.overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
    });
    this.handlers = handlers;

    map.addControl(this.overlay as any);

    map.addControl(
      new mapboxgl.AttributionControl({
        compact: false,
      }),
      "bottom-right",
    );
    map.addControl(new mapboxgl.NavigationControl({}), "bottom-right");
    map.addControl(
      new CustomMapControl(
        {
          name: FIT_TO_EXTENT_CONTROL,
          title: "Fit to network",
          icon: FIT_TO_EXTENT_ICON,
        },
        onControlClick,
      ),
      "bottom-right",
    );
    map.getCanvas().style.cursor = CURSOR_DEFAULT;
    map.keyboard.disableRotation();
    map.on("click", (e) => this.handlers.current.onClick(e));
    map.on("mousedown", (e) => this.handlers.current.onMapMouseDown(e));
    map.on("mousemove", (e) => this.handlers.current.onMapMouseMove(e));
    map.on("dblclick", (e) => this.handlers.current.onDoubleClick(e));
    map.on("mouseup", (e) => this.handlers.current.onMapMouseUp(e));
    map.on("moveend", (e: MoveEvent) => this.handlers.current.onMoveEnd(e));
    map.on("touchend", (e) => this.handlers.current.onMapTouchEnd(e));
    map.on("move", (e: MoveEvent) => this.handlers.current.onMove(e));

    map.on("touchstart", (e) => this.handlers.current.onMapTouchStart(e));
    map.on("touchmove", (e) => this.handlers.current.onMapTouchMove(e));
    map.on("touchend", (e) => this.handlers.current.onMapTouchEnd(e));
    map.on("zoom", (e: mapboxgl.MapBoxZoomEvent) =>
      this.handlers.current.onZoom(e),
    );

    this.map = map;
  }

  setStyle(style: Style): Promise<void> {
    return new Promise((resolve) => {
      this.map.once("style.load", () => {
        resolve();
      });

      const forceStyleLoadEvent = { diff: false };
      this.map.setStyle(style, forceStyleLoadEvent);
    });
  }

  addIcons(icons: IconImage[]): void {
    for (const { id, image, isSdf } of icons) {
      if (this.map.hasImage(id)) return;

      this.map.addImage(id, image, { sdf: isSdf });
    }
  }

  setSource(name: string, sourceFeatures: Feature<Geometry | null>[]): void {
    if (!this.map || !(this.map as any).style) return;
    const featuresSource = this.map.getSource(name);
    if (!featuresSource) return;
    if (featuresSource.type !== "geojson") {
      throw new SourceTypeMismatchError(name, featuresSource.type);
    }

    featuresSource.setData({
      type: "FeatureCollection",
      features: sourceFeatures,
    } as FeatureCollection);
  }

  removeSource(name: string) {
    if (!this.map || !(this.map as any).style) return;
    const source = this.map.getSource(name);
    if (!source) return;

    this.map.getStyle().layers.forEach((layer) => {
      this.map.removeLayer(layer.id);
    });

    this.map.removeSource(name);
  }

  // Feature-state target. `sourceLayer` is undefined for a plain geojson source
  // (identical to a plain {source, id} target) and set only when the source exposes
  // composite source-layers, in which case feature state is scoped per source-layer.
  private featureStateTarget(
    sourceName: string,
    sourceLayer?: string,
    featureId?: RawId,
  ): { source: string; sourceLayer?: string; id?: RawId } {
    const target: { source: string; sourceLayer?: string; id?: RawId } = {
      source: sourceName,
    };
    if (sourceLayer !== undefined) target.sourceLayer = sourceLayer;
    if (featureId !== undefined) target.id = featureId;
    return target;
  }

  showFeature(
    sourceName: string,
    featureId: RawId,
    sourceLayer?: string,
  ): void {
    if (!this.map || !(this.map as any).style) return;
    this.map.removeFeatureState(
      this.featureStateTarget(sourceName, sourceLayer, featureId),
      "hidden",
    );
  }

  hideFeature(
    sourceName: string,
    featureId: RawId,
    sourceLayer?: string,
  ): void {
    if (!this.map || !(this.map as any).style) return;

    this.map.setFeatureState(
      this.featureStateTarget(sourceName, sourceLayer, featureId),
      {
        hidden: true,
      },
    );
  }

  showLayers(layerIds: string[]) {
    for (const layerId of layerIds) {
      this.map.setLayoutProperty(layerId, "visibility", "visible");
    }
  }

  addLayer(layer: mapboxgl.AnyLayer, beforeId?: string) {
    this.map.addLayer(layer, beforeId);
  }

  hideLayers(layerIds: string[]) {
    for (const layerId of layerIds) {
      this.map.setLayoutProperty(layerId, "visibility", "none");
    }
  }

  showFeatures(
    sourceName: string,
    featureIds: RawId[],
    sourceLayer?: string,
  ): void {
    if (!this.map || !(this.map as any).style) return;

    for (const featureId of featureIds) {
      this.showFeature(sourceName, featureId, sourceLayer);
    }
  }

  hideFeatures(
    sourceName: string,
    featureIds: RawId[],
    sourceLayer?: string,
  ): void {
    if (!this.map || !(this.map as any).style) return;

    for (const featureId of featureIds) {
      this.hideFeature(sourceName, featureId, sourceLayer);
    }
  }

  clearFeatureState(sourceName: string, sourceLayer?: string): void {
    if (!this.map || !(this.map as any).style) return;
    this.map.removeFeatureState(
      this.featureStateTarget(sourceName, sourceLayer),
    );
  }

  setLayerFilter(layerId: string, filter: mapboxgl.Expression): void {
    if (!this.map || !(this.map as any).style) return;

    this.map.setFilter(layerId, filter);
  }

  setLayerPaintRule(
    layerId: string,
    name: string,
    rule: mapboxgl.Expression | number,
  ): void {
    if (!this.map || !(this.map as any).style) return;

    this.map.setPaintProperty(layerId, name, rule);
  }

  setLayerMinZoom(layerId: string, minzoom: number): void {
    if (!this.map || !(this.map as any).style) return;

    // +1 because mapbox hides a layer once zoom >= maxzoom, so this keeps the
    // layer visible at the highest map zoom.
    this.map.setLayerZoomRange(layerId, minzoom, MAP_MAX_ZOOM + 1);
  }

  private memoizedNavigableMinZoom = memo(
    () =>
      [
        this.map.getCenter().lat,
        this.map.getContainer()?.clientHeight ?? 0,
        this.map.getMaxZoom(),
      ] as const,
    (lat, height, maxZoom) => computeSameCenterMinZoom(height, lat, maxZoom),
  );

  /* Lowest zoom that preserves the current map center position. */
  getNavigableMinZoom(): number {
    if (!this.map.getContainer()) return this.map.getMinZoom();
    return this.memoizedNavigableMinZoom();
  }

  setOverlay(layers: LayersList) {
    this.overlay.setProps({ layers });
  }

  suspendOverlayStyleReactions() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (this.overlay as any)._handleStyleChange as
      | (() => void)
      | undefined;
    if (handler) this.map.off("styledata", handler);
  }

  resumeOverlayStyleReactions() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (this.overlay as any)._handleStyleChange as
      | (() => void)
      | undefined;
    if (handler) {
      this.map.on("styledata", handler);
    }
  }

  isStyleLoaded(): boolean {
    return !!(
      this.map &&
      (this.map as any).style &&
      this.map.getSource("delta-features")
    );
  }

  pickOverlayObjects({
    x,
    y,
    radius = 7,
  }: {
    x: number;
    y: number;
    radius?: number;
  }) {
    // pickObjects treats x,y as the top-left corner of the search box, so
    // shift the origin up-left by `radius` to center the box on the cursor.
    return this.overlay.pickObjects({
      x: x - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2,
    });
  }

  getZoom(): number {
    return this.map.getZoom();
  }

  getPrecision(): number {
    return precisionForZoom(this.getZoom());
  }

  getBounds(): mapboxgl.LngLatBounds {
    return this.map.getBounds();
  }

  setBounds(
    bounds: mapboxgl.LngLatBounds,
    options?: { animate?: boolean },
  ): void {
    this.map.fitBounds(bounds, options);
  }

  queryRenderedFeatures(
    pointOrBox: Parameters<MapboxMap["queryRenderedFeatures"]>[0],
    options: Parameters<MapboxMap["queryRenderedFeatures"]>[1],
  ) {
    const layers = options?.layers || [];

    const availableLayers = layers.filter(
      (layer) => !!this.map.getLayer(layer),
    );

    return this.map.queryRenderedFeatures(pointOrBox, {
      ...options,
      layers: availableLayers,
    });
  }

  searchNearbyRenderedFeatures({
    point,
    distance = 12,
    layers,
  }: {
    point: mapboxgl.Point;
    distance?: number;
    layers: string[];
  }): MapboxGeoJSONFeature[] {
    const { x, y } = point;

    const searchBox = [
      [x - distance, y - distance] as mapboxgl.PointLike,
      [x + distance, y + distance] as mapboxgl.PointLike,
    ] as [mapboxgl.PointLike, mapboxgl.PointLike];

    return this.queryRenderedFeatures(searchBox, {
      layers: layers as unknown as string[],
    });
  }

  remove() {
    this.map.remove();
  }

  getFeatureState(
    source: string,
    featureId: RawId,
    sourceLayer?: string,
  ): Record<string, any> {
    if (!this.map || !(this.map as any).style) return {};

    return (
      this.map.getFeatureState(
        this.featureStateTarget(source, sourceLayer, featureId),
      ) || {}
    );
  }

  isFeatureHidden(
    source: string,
    featureId: RawId,
    sourceLayer?: string,
  ): boolean {
    const featureState = this.getFeatureState(source, featureId, sourceLayer);
    return featureState.hidden === true;
  }

  safeResize() {
    if (this.map && this.map.getCanvas()) {
      this.map.resize();
      if (
        this.overlay &&
        (this.overlay as any).deck &&
        (this.overlay as any).deck.redraw
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (this.overlay as any).deck.redraw(true);
      }
    }
  }

  private settleQueue: Array<() => void> = [];

  enqueueOnSettle(task: () => void): void {
    this.settleQueue.push(task);
  }

  flushSettleQueue(): void {
    if (this.settleQueue.length === 0) return;
    const tasks = this.settleQueue;
    this.settleQueue = [];
    for (const task of tasks) task();
  }

  onNextIdle(callback: (settledCleanly: boolean) => void): void {
    if (!this.map || !(this.map as any).style || this.map.loaded()) {
      callback(false);
      return;
    }

    const alreadyWaiting = this.idleCallback !== null;
    this.idleCallback = callback;
    this.idleDisturbed = this.map.isMoving();

    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(this.onIdleTimeout, IDLE_TIMEOUT_MS);

    if (!alreadyWaiting) {
      this.map.once("idle", this.onIdleEvent);
      this.map.on("movestart", this.markIdleDisturbed);
    }
  }

  private markIdleDisturbed = () => {
    this.idleDisturbed = true;
  };

  private onIdleEvent = () => this.finishIdleWait(!this.idleDisturbed);
  private onIdleTimeout = () => this.finishIdleWait(false);

  private finishIdleWait(settledCleanly: boolean): void {
    const callback = this.idleCallback;
    this.idleCallback = null;
    this.idleDisturbed = false;
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.map.off("idle", this.onIdleEvent);
    this.map.off("movestart", this.markIdleDisturbed);
    callback?.(settledCleanly);
  }
}
