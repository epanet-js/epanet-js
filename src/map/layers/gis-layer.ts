import { CircleLayer, FillLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { strokeColorFor } from "src/lib/color";

export function gisLayerFill(
  sourceId: string,
  color: string,
  opacity: number,
  visible: boolean,
): FillLayer {
  return {
    id: `${sourceId}-fill`,
    type: "fill",
    source: sourceId,
    filter: ["==", "$type", "Polygon"],
    paint: {
      "fill-color": color,
      "fill-opacity": opacity * 0.3,
    },
    layout: {
      visibility: visible ? "visible" : "none",
    },
  };
}

export function gisLayerLine(
  sourceId: string,
  color: string,
  lineWidth: number,
  opacity: number,
  visible: boolean,
): LineLayer {
  return {
    id: `${sourceId}-line`,
    type: "line",
    source: sourceId,
    filter: ["any", ["==", "$type", "LineString"], ["==", "$type", "Polygon"]],
    paint: {
      "line-color": color,
      "line-width": lineWidth,
      "line-opacity": opacity,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: visible ? "visible" : "none",
    },
  };
}

export function gisLayerCircle(
  sourceId: string,
  color: string,
  opacity: number,
  visible: boolean,
): CircleLayer {
  return {
    id: `${sourceId}-circle`,
    type: "circle",
    source: sourceId,
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-color": color,
      "circle-radius": 4,
      "circle-opacity": opacity,
      "circle-stroke-color": strokeColorFor(color),
      "circle-stroke-width": 1,
      "circle-stroke-opacity": opacity,
    },
    layout: {
      visibility: visible ? "visible" : "none",
    },
  };
}

export function gisLayerLabel(
  sourceId: string,
  color: string,
  opacity: number,
  visible: boolean,
  labelProperty?: string,
): SymbolLayer {
  return {
    id: `${sourceId}-label`,
    type: "symbol",
    source: sourceId,
    filter: labelProperty ? ["has", labelProperty] : ["==", 0, 1],
    layout: {
      "text-field": labelProperty ? ["get", labelProperty] : "",
      "text-size": 11,
      "text-allow-overlap": false,
      visibility: visible ? "visible" : "none",
    },
    paint: {
      "text-color": color,
      "text-halo-color": strokeColorFor(color),
      "text-halo-width": 1.5,
      "text-opacity": opacity,
    },
  };
}
