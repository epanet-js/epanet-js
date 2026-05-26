import { FillLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";

export const mapOverlayFillLayer = ({
  source,
}: {
  source: DataSource;
}): FillLayer => ({
  id: "map-overlay-fill",
  type: "fill",
  source,
  filter: ["==", "$type", "Polygon"],
  paint: {
    "fill-color": "#a855f7",
    "fill-opacity": ["case", ["==", ["get", "isFilled"], true], 0.15, 0],
  },
});

export const mapOverlayOutlineLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => ({
  id: "map-overlay-outline",
  type: "line",
  source,
  filter: ["==", "$type", "Polygon"],
  paint: {
    "line-color": [
      "case",
      ["==", ["get", "isDisabled"], true],
      "#9ca3af",
      "#a855f7",
    ],
    "line-width": ["case", ["==", ["get", "isDisabled"], true], 1, 2],
  },
});

export const mapOverlayLabelLayer = ({
  source,
}: {
  source: DataSource;
}): SymbolLayer => ({
  id: "map-overlay-label",
  type: "symbol",
  source,
  filter: ["has", "label"],
  layout: {
    "text-field": ["get", "label"],
    "text-size": 12,
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": "#7e22ce",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
});
