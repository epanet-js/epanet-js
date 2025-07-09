import { CircleLayer, LineLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";

export const snappingCandidateLayer = ({ source }: { source: DataSource }) => {
  return {
    id: "snapping-candidate",
    type: "circle",
    source,
    layout: {},
    filter: ["==", "type", "snapping-candidate"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 24],
      "circle-color": colors.indigo300,
      "circle-opacity": 0.7,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  } as CircleLayer;
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
