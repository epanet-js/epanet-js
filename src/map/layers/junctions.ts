import { CircleLayer } from "mapbox-gl";
import { LINE_COLORS_SELECTED } from "src/lib/constants";
import { asColorExpression, asNumberExpression } from "src/lib/symbolization";
import { ISymbolization } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";

export const junctionsLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": [
        "case",
        ["boolean", ["feature-state", "hidden"], false],
        0,
        asNumberExpression({
          symbolization,
          part: "circle-opacity",
          defaultValue: 1,
        }),
      ],
      "circle-stroke-color": [
        "match",
        ["feature-state", "selected"],
        "true",
        LINE_COLORS_SELECTED,
        "white",
      ],
      "circle-stroke-width": 0,
      "circle-radius": 6,
      "circle-color": [
        "match",
        ["feature-state", "selected"],
        "true",
        LINE_COLORS_SELECTED,
        asColorExpression({
          symbolization,
          part: "stroke",
        }),
      ],
    },
  };
};
