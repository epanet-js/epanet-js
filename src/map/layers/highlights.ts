import { CircleLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";

export const highlightsMarkerHaloLayer = ({
  source,
}: {
  source: DataSource;
}) => {
  return {
    id: "highlights-marker-halo",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "$type", "Point"], ["has", "marker"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 24],
      "circle-color": colors.cyan300,
      "circle-opacity": 0.7,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  } as CircleLayer;
};

export const highlightsMarkerLayer = ({ source }: { source: DataSource }) => {
  return {
    id: "highlights-marker",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "$type", "Point"], ["has", "marker"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 5, 20, 8],
      "circle-color": colors.cyan600,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
    minzoom: 10,
  } as CircleLayer;
};
