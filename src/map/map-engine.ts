import mapboxgl, { MapboxEvent, Style } from "mapbox-gl";
import type { Map as MapboxMap } from "mapbox-gl";

import { CURSOR_DEFAULT } from "src/lib/constants";
import type { Feature, IFeatureCollection } from "src/types";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { captureWarning } from "src/infra/error-tracking";
import { LayersList } from "@deck.gl/core";
import { DataSource } from "./data-source";
import { prepareIconsSprite } from "./icons";
import { IconImage } from "./icons";
import { LayerId } from "./layers";

const MAP_OPTIONS: Omit<mapboxgl.MapboxOptions, "container"> = {
  style: { version: 8, layers: [], sources: {} },
  maxZoom: 26,
  boxZoom: false,
  dragRotate: false,
  attributionControl: false,
  fadeDuration: 0,
  antialias: true,
  doubleClickZoom: false,
};

const sourceUpdateTimeoutFor = (totalFeatures: number): number => {
  if (totalFeatures < 1000) return 2000;
  if (totalFeatures < 10000) return 5000;

  return 10000;
};

type ClickEvent = mapboxgl.MapMouseEvent & mapboxgl.EventData;
type MoveEvent = mapboxgl.MapboxEvent & mapboxgl.EventData;

export type MapHandlers = {
  onClick: (e: ClickEvent) => void;
  onDoubleClick: (e: ClickEvent) => void;
  onMapMouseUp: (e: mapboxgl.MapMouseEvent) => void;
  onMapMouseMove: (e: mapboxgl.MapMouseEvent) => void;
  onMapTouchMove: (e: mapboxgl.MapTouchEvent) => void;
  onMapMouseDown: (e: mapboxgl.MapMouseEvent) => void;
  onMapTouchStart: (e: mapboxgl.MapTouchEvent) => void;
  onMoveEnd: (e: mapboxgl.MapboxEvent & mapboxgl.EventData) => void;
  onMapTouchEnd: (e: mapboxgl.MapTouchEvent) => void;
  onMove: (e: mapboxgl.MapboxEvent & mapboxgl.EventData) => void;
  onZoom: (e: mapboxgl.MapBoxZoomEvent) => void;
};

export class MapEngine {
  map: mapboxgl.Map;
  handlers: React.MutableRefObject<MapHandlers>;
  overlay: MapboxOverlay;
  private icons: IconImage[] = [];

  constructor({
    element,
    handlers,
  }: {
    element: HTMLDivElement;
    handlers: React.MutableRefObject<MapHandlers>;
  }) {
    const defaultStart = {
      center: [-4.3800042, 55.914314] as mapboxgl.LngLatLike,
      zoom: 15.5,
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
      new mapboxgl.GeolocateControl({
        showUserLocation: false,
        showAccuracyCircle: false,
        positionOptions: {
          enableHighAccuracy: true,
        },
      }),
      "bottom-right",
    );
    map.getCanvas().style.cursor = CURSOR_DEFAULT;
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

    map.on("style.load", async () => {
      if (!this.icons.length) {
        this.icons = await prepareIconsSprite();
      }

      for (const { id, image, isSdf } of this.icons) {
        if (map.hasImage(id)) return;

        map.addImage(id, image, { sdf: isSdf });
      }
    });

    this.map = map;
  }

  setStyle(style: Style): Promise<void> {
    return new Promise((resolve) => {
      const idleTimeoutMs = 2000;
      const timeout = setTimeout(() => {
        captureWarning(
          `Timeout: Mapbox styledata event took more than ${idleTimeoutMs}`,
        );
        resolve();
      }, idleTimeoutMs);

      this.map.once("styledata", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.map.setStyle(style);
    });
  }

  setSource(name: DataSource, sourceFeatures: Feature[]): Promise<void> {
    if (!(this.map && (this.map as any).style)) {
      return Promise.resolve();
    }

    const featuresSource = this.map.getSource(name) as mapboxgl.GeoJSONSource;
    if (!featuresSource) return Promise.resolve();

    return new Promise((resolve) => {
      const idleTimeoutMs = sourceUpdateTimeoutFor(sourceFeatures.length);
      const timeout = setTimeout(() => {
        captureWarning(
          `Timeout: Mapbox idle took more than ${idleTimeoutMs}, ${sourceFeatures.length}`,
        );
        resolve();
      }, idleTimeoutMs);

      this.map.once("idle", () => {
        clearTimeout(timeout);
        resolve();
      });

      featuresSource.setData({
        type: "FeatureCollection",
        features: sourceFeatures,
      } as IFeatureCollection);

      if (!sourceFeatures.length) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  removeSource(name: DataSource) {
    const source = this.map.getSource(name);
    if (!source) return;

    this.map.getStyle().layers.forEach((layer) => {
      this.map.removeLayer(layer.id);
    });

    this.map.removeSource(name);
  }

  showFeature(sourceName: DataSource, featureId: RawId): void {
    if (!this.map || !(this.map as any).style) return;
    this.map.removeFeatureState(
      {
        source: sourceName,
        id: featureId,
      },
      "hidden",
    );
  }

  hideFeature(sourceName: DataSource, featureId: RawId): void {
    if (!this.map || !(this.map as any).style) return;

    this.map.setFeatureState(
      {
        source: sourceName,
        id: featureId,
      },
      {
        hidden: true,
      },
    );
  }

  showLayers(layerIds: LayerId[]) {
    for (const layerId of layerIds) {
      this.map.setLayoutProperty(layerId, "visibility", "visible");
    }
  }

  hideLayers(layerIds: LayerId[]) {
    for (const layerId of layerIds) {
      this.map.setLayoutProperty(layerId, "visibility", "none");
    }
  }

  showFeatures(sourceName: DataSource, featureIds: RawId[]): void {
    if (!this.map || !(this.map as any).style) return;

    for (const featureId of featureIds) {
      this.showFeature(sourceName, featureId);
    }
  }

  hideFeatures(sourceName: DataSource, featureIds: RawId[]): void {
    if (!this.map || !(this.map as any).style) return;

    for (const featureId of featureIds) {
      this.hideFeature(sourceName, featureId);
    }
  }

  setOverlay(layers: LayersList) {
    this.overlay.setProps({ layers });
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

  remove() {
    this.map.remove();
  }

  selectFeature(sourceName: DataSource, featureId: RawId): void {
    this.setFeatureState(sourceName, featureId, { selected: "true" });
  }

  unselectFeature(sourceName: DataSource, featureId: RawId): void {
    this.removeFeatureState(sourceName, featureId, "selected");
  }

  private setFeatureState(
    source: DataSource,
    featureId: RawId,
    data: Record<string, string | boolean>,
  ) {
    this.map.setFeatureState(
      {
        source,
        id: featureId,
      },
      data,
    );
  }

  private removeFeatureState(
    source: DataSource,
    featureId: RawId,
    key: string,
  ) {
    this.map.removeFeatureState(
      {
        source: source,
        id: featureId,
      },
      key,
    );
  }
}
