import mapboxgl from "mapbox-gl";

export type ClickEvent = mapboxgl.MapMouseEvent & mapboxgl.EventData;
export type MoveEvent = mapboxgl.MapboxEvent & mapboxgl.EventData;

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

export type MapEventHandler = (event: any) => void;
