import { FillLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../../data-source";
import { colors } from "src/lib/constants";

export const zoneFillLayer = ({
  source,
}: {
  source: DataSource;
}): FillLayer => ({
  id: "zones-fill",
  type: "fill",
  source,
  paint: {
    "fill-color": "#ea580c",
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.15, 15, 0.03],
  },
});

export const zoneOutlineLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => ({
  id: "zones-outline",
  type: "line",
  source,
  paint: {
    "line-color": "#ea580c",
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.25, 16, 2],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 15, 0.15],
  },
});

export const zoneLabelsLayer = ({
  source,
}: {
  source: DataSource;
}): SymbolLayer => ({
  id: "zones-labels",
  type: "symbol",
  source,
  paint: {
    "text-halo-color": "#fff",
    "text-halo-width": 2,
    "text-halo-blur": 0.8,
    "text-color": colors.gray500,
  },
  layout: {
    "text-field": ["get", "label"],
    "symbol-placement": "point",
    "icon-optional": true,
    "text-size": 11,
    "text-font": [
      "Open Sans Bold",
      "Arial Unicode MS Bold",
      "Open Sans Regular",
      "Arial Unicode MS Regular",
    ],
    "text-letter-spacing": 0,
    "text-allow-overlap": false,
    "text-variable-anchor": ["center"],
    visibility: "none",
  },
});
