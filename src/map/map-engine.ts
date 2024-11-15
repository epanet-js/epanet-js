import mapboxgl, { MapboxEvent, Style } from "mapbox-gl";
import {
  FEATURES_SOURCE_NAME,
  IMPORTED_FEATURES_SOURCE_NAME,
} from "src/lib/load_and_augment_style";
import type { Sel } from "src/state/jotai";
import { CURSOR_DEFAULT, emptySelection } from "src/lib/constants";
import type { Feature, IFeatureCollection } from "src/types";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { isDebugOn } from "src/infra/debug-mode";
import { USelection } from "src/selection";
import { captureWarning } from "src/infra/error-tracking";
import { LayersList } from "@deck.gl/core";

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
};

const noop = () => null;
const debugEvent = isDebugOn
  ? (e: mapboxgl.MapboxEvent<any>) => {
      // eslint-disable-next-line no-console
      console.log(`MAPBOX_EVENT: ${e.type}`);
    }
  : noop;

export class MapEngine {
  map: mapboxgl.Map;
  handlers: React.MutableRefObject<MapHandlers>;
  idMap: IDMap;
  lastSelectionIds: Set<RawId>;
  overlay: MapboxOverlay;

  constructor({
    element,
    handlers,
    idMap,
    controlsCorner = "bottom-left",
  }: {
    element: HTMLDivElement;
    handlers: React.MutableRefObject<MapHandlers>;
    idMap: IDMap;
    controlsCorner?: Parameters<mapboxgl.Map["addControl"]>[1];
  }) {
    this.idMap = idMap;
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
      new mapboxgl.GeolocateControl({
        showUserLocation: false,
        showAccuracyCircle: false,
        positionOptions: {
          enableHighAccuracy: true,
        },
      }),
      controlsCorner,
    );
    map.addControl(new mapboxgl.NavigationControl({}), controlsCorner);
    map.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
      }),
    );
    map.getCanvas().style.cursor = CURSOR_DEFAULT;
    map.on("click", this.onClick);
    map.on("mousedown", this.onMapMouseDown);
    map.on("mousemove", this.onMapMouseMove);
    map.on("dblclick", this.onMapDoubleClick);
    map.on("mouseup", this.onMapMouseUp);
    map.on("moveend", this.onMoveEnd);
    map.on("touchend", this.onMapTouchEnd);
    map.on("move", this.onMove);

    map.on("touchstart", this.onMapTouchStart);
    map.on("touchmove", this.onMapTouchMove);
    map.on("touchend", this.onMapTouchEnd);

    this.lastSelectionIds = emptySelection;
    this.map = map;
  }

  onClick = (e: LayerScopedEvent) => {
    debugEvent(e);
    this.handlers.current.onClick(e);
  };

  onMapMouseDown = (e: LayerScopedEvent) => {
    debugEvent(e);
    this.handlers.current.onMapMouseDown(e);
  };

  onMapTouchStart = (e: mapboxgl.MapTouchEvent) => {
    debugEvent(e);
    this.handlers.current.onMapTouchStart(e);
  };

  onMapMouseUp = (e: LayerScopedEvent) => {
    debugEvent(e);
    this.handlers.current.onMapMouseUp(e);
  };

  onMoveEnd = (e: MoveEvent) => {
    debugEvent(e);
    this.handlers.current.onMoveEnd(e);
  };

  onMapTouchEnd = (e: mapboxgl.MapTouchEvent) => {
    debugEvent(e);
    this.handlers.current.onMapTouchEnd(e);
  };

  onMove = (e: MoveEvent) => {
    debugEvent(e);
    this.handlers.current.onMove(e);
  };

  onMapMouseMove = (e: mapboxgl.MapMouseEvent) => {
    debugEvent(e);
    this.handlers.current.onMapMouseMove(e);
  };

  onMapTouchMove = (e: mapboxgl.MapTouchEvent) => {
    debugEvent(e);
    this.handlers.current.onMapTouchMove(e);
  };

  onMapDoubleClick = (e: mapboxgl.MapMouseEvent) => {
    debugEvent(e);
    this.handlers.current.onDoubleClick(e);
  };

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

  setSource(name: string, sourceFeatures: Feature[]): Promise<void> {
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

  removeSource(name: string) {
    const source = this.map.getSource(name);
    if (!source) return;

    this.map.getStyle().layers.forEach((layer) => {
      this.map.removeLayer(layer.id);
    });

    this.map.removeSource(name);
  }

  showFeatures(sourceName: string, featureIds: RawId[]): void {
    if (!this.map || !(this.map as any).style) return;

    for (const featureId of featureIds) {
      this.map.removeFeatureState(
        {
          source: sourceName,
          id: featureId,
        },
        "hidden",
      );
    }
  }

  hideFeatures(sourceName: string, featureIds: RawId[]): void {
    if (!this.map || !(this.map as any).style) return;

    for (const featureId of featureIds) {
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
  }

  setOnlySelection(selection: Sel) {
    this.updateSelections(
      new Set(
        USelection.toIds(selection).map((uuid) =>
          UIDMap.getIntID(this.idMap, uuid),
        ),
      ),
    );
  }

  setOverlay(layers: LayersList) {
    this.overlay.setProps({ layers });
  }

  remove() {
    this.map.remove();
  }

  setElevationsSource() {
    this.map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
    });
    const noExageration = 1;
    this.map.setTerrain({ source: "mapbox-dem", exaggeration: noExageration });
  }

  private updateSelections(newSet: Set<RawId>) {
    if (!this.map || !(this.map as any).style) return;
    const oldSet = this.lastSelectionIds;
    const tmpSet = new Set(newSet);

    for (const id of tmpSet) {
      if (!oldSet.has(id)) {
        this.map.setFeatureState(
          {
            source: FEATURES_SOURCE_NAME,
            id,
          },
          {
            selected: "true",
          },
        );
        this.map.setFeatureState(
          {
            source: IMPORTED_FEATURES_SOURCE_NAME,
            id,
          },
          {
            selected: "true",
          },
        );
        tmpSet.delete(id);
      }
    }

    for (const id of oldSet) {
      if (!tmpSet.has(id)) {
        this.map.removeFeatureState(
          {
            source: FEATURES_SOURCE_NAME,
            id,
          },
          "selected",
        );
        this.map.removeFeatureState(
          {
            source: IMPORTED_FEATURES_SOURCE_NAME,
            id,
          },
          "selected",
        );
      }
    }

    this.lastSelectionIds = newSet;
  }
}
