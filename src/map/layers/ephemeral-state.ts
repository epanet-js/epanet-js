import { CircleLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";
import { junctionCircleSizes } from "./junctions";

export const snappingCandidateHaloLayer = ({
  source,
}: {
  source: DataSource;
}) => {
  return {
    id: "snapping-candidate-halo",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "type", "draw-link-node"], ["has", "halo"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 24],
      "circle-color": colors.indigo300,
      "circle-opacity": 0.7,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  } as CircleLayer;
};

export const drawLinkNodeLayers = ({ source }: { source: DataSource }) => {
  return {
    id: "ephemeral-draw-link-nodes",
    type: "circle",
    source,
    layout: {},
    filter: ["all", ["==", "type", "draw-link-node"], ["!has", "icon"]],
    paint: {
      "circle-color": colors.indigo800,
      "circle-stroke-color": colors.indigo200,
      ...junctionCircleSizes(),
    },
    minzoom: 10,
  } as CircleLayer;
};

export const drawLinkIconLayers = ({ source }: { source: DataSource }) => {
  return {
    id: "ephemeral-draw-link-icons",
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "point",
      "icon-image": ["get", "icon"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.2, 20, 0.4],
      "icon-allow-overlap": true,
    },
    filter: ["all", ["==", "type", "draw-link-node"], ["has", "icon"]],
    paint: {
      "icon-opacity": 1,
    },
  } as SymbolLayer;
};

export const draftLineLayer = ({
  source,
}: {
  source: DataSource;
}): LineLayer => {
  return {
    id: "draft-line",
    type: "line",
    source,
    filter: ["==", "type", "draw-link-line"],
    paint: {
      "line-opacity": 1,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
      "line-color": colors.indigo500,
      "line-dasharray": [1, 1],
    },
  };
};
