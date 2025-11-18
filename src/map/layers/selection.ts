import { CircleLayer, LineLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";
import {
  junctionCircleSizes,
  junctionCircleSizesWithActiveTopology,
} from "./junctions";
import { colors } from "src/lib/constants";

const LINE_COLORS_SELECTED = colors.fuchsia500;
const POINT_COLORS_SELECTED = colors.fuchsia500;
const POINT_COLORS_SELECTED_WITH_ACTIVE_TOPOLOGY = colors.fuchsia300;
const LINE_COLORS_SELECTED_DISABLED = colors.fuchsia300;
const POINT_COLORS_SELECTED_DISABLED = colors.fuchsia100;

export const selectedPipesLayerWithActiveTopology = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pipe"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "closed"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "closed"], 4, 5],
      ],
      "line-color": [
        "case",
        ["==", ["get", "isActive"], false],
        LINE_COLORS_SELECTED_DISABLED,
        LINE_COLORS_SELECTED,
      ],
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedPumpLinesLayerWithActiveTopology = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pump"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "off"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "off"], 2, 3],
      ],
      "line-color": [
        "case",
        ["==", ["get", "isActive"], false],
        LINE_COLORS_SELECTED_DISABLED,
        LINE_COLORS_SELECTED,
      ],
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "off"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedValveLinesLayerWithActiveTopology = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "valve"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "closed"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "closed"], 2, 3],
      ],
      "line-color": [
        "case",
        ["==", ["get", "isActive"], false],
        LINE_COLORS_SELECTED_DISABLED,
        LINE_COLORS_SELECTED,
      ],
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedJunctionsLayerWithActiveTopology = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": 1,
      "circle-stroke-color": [
        "case",
        ["==", ["get", "isActive"], false],
        POINT_COLORS_SELECTED_WITH_ACTIVE_TOPOLOGY,
        LINE_COLORS_SELECTED,
      ],
      ...junctionCircleSizesWithActiveTopology(),
      "circle-stroke-opacity": 1,
      "circle-color": [
        "case",
        ["==", ["get", "isActive"], false],
        POINT_COLORS_SELECTED_DISABLED,
        POINT_COLORS_SELECTED,
      ],
    },
    minzoom: 13,
  };
};

export const selectedIconsLayerWithActiveTopology = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "icon-image": [
        "case",
        ["==", ["get", "isActive"], false],
        ["concat", ["get", "type"], "-disabled-selected"],
        ["concat", ["get", "type"], "-selected"],
      ],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        ["match", ["get", "type"], "reservoir", 0.2, 0.2],
        20,
        ["match", ["get", "type"], "reservoir", 0.5, 0.4],
      ],
      "icon-allow-overlap": true,
      "icon-rotation-alignment": "map",
      "icon-rotate": ["get", "rotation"],
    },
    filter: [
      "all",
      ["has", "icon"],
      ["any", ["==", "type", "tank"], ["==", "type", "reservoir"]],
    ],
    paint: {
      "icon-opacity": 1,
    },
    minzoom: 10,
  };
};

export const selectedIconsHaloLayerWithActiveTopology = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    layout: {},
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["any", ["==", "type", "pump"], ["==", "type", "valve"]],
    ],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 22],
      "circle-color": [
        "case",
        ["==", ["get", "isActive"], false],
        POINT_COLORS_SELECTED_DISABLED,
        POINT_COLORS_SELECTED,
      ],
      "circle-opacity": 0.8,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  };
};

export const selectedPipeArrowsLayerWithActiveTopology = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "line-center",
      "icon-image": "triangle",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.2, 26, 0.5],
      "icon-rotate": ["get", "rotation"],
      "icon-ignore-placement": true,
      "icon-allow-overlap": true,
      visibility: "none",
    },
    filter: [
      "all",
      ["==", "$type", "LineString"],
      ["==", "type", "pipe"],
      ["==", "hasArrow", true],
    ],
    paint: {
      "icon-color": LINE_COLORS_SELECTED,
      "icon-opacity": zoomOpacityExpression(
        [14, 15, 16, 17, 18, 19, 20],
        [200, 100, 50, 20, 10, 5, 0],
      ),
    },
    minzoom: 14,
  };
};

export const selectedPipesLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pipe"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "closed"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "closed"], 4, 5],
      ],
      "line-color": LINE_COLORS_SELECTED,
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedPumpLinesLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pump"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "off"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "off"], 2, 3],
      ],
      "line-color": LINE_COLORS_SELECTED,
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "off"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedValveLinesLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "valve"],
    paint: {
      "line-opacity": 1,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["case", ["==", ["get", "status"], "closed"], 0.5, 1],
        16,
        ["case", ["==", ["get", "status"], "closed"], 2, 3],
      ],
      "line-color": LINE_COLORS_SELECTED,
      "line-dasharray": [
        "case",
        ["==", ["get", "status"], "closed"],
        ["literal", [2, 1]],
        ["literal", [1, 0]],
      ],
    },
  };
};

export const selectedJunctionsLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": 1,
      "circle-stroke-color": strokeColorFor(POINT_COLORS_SELECTED),
      ...junctionCircleSizes(),
      "circle-stroke-opacity": 1,
      "circle-color": POINT_COLORS_SELECTED,
    },
    minzoom: 13,
  };
};

export const selectedIconsLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "icon-image": ["concat", ["get", "type"], "-selected"],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        ["match", ["get", "type"], "reservoir", 0.2, 0.2],
        20,
        ["match", ["get", "type"], "reservoir", 0.5, 0.4],
      ],
      "icon-allow-overlap": true,
      "icon-rotation-alignment": "map",
      "icon-rotate": ["get", "rotation"],
    },
    filter: [
      "all",
      ["has", "icon"],
      [
        "any",
        ["==", "type", "pump"],
        ["==", "type", "valve"],
        ["==", "type", "tank"],
        ["==", "type", "reservoir"],
      ],
    ],
    paint: {
      "icon-opacity": 1,
    },
    minzoom: 10,
  };
};

export const selectedIconsHaloLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    layout: {},
    filter: [
      "all",
      ["==", "$type", "Point"],
      ["any", ["==", "type", "pump"], ["==", "type", "valve"]],
    ],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 20, 22],
      "circle-color": LINE_COLORS_SELECTED,
      "circle-opacity": 0.8,
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 12, 0, 20, 0.8],
    },
    minzoom: 10,
  };
};

export const selectedPipeArrowsLayer = ({
  source,
  layerId,
}: {
  source: DataSource;
  layerId: LayerId;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "line-center",
      "icon-image": "triangle",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.2, 26, 0.5],
      "icon-rotate": ["get", "rotation"],
      "icon-ignore-placement": true,
      "icon-allow-overlap": true,
      visibility: "none",
    },
    filter: [
      "all",
      ["==", "$type", "LineString"],
      ["==", "type", "pipe"],
      ["==", "hasArrow", true],
    ],
    paint: {
      "icon-color": LINE_COLORS_SELECTED,
      "icon-opacity": zoomOpacityExpression(
        [14, 15, 16, 17, 18, 19, 20],
        [200, 100, 50, 20, 10, 5, 0],
      ),
    },
    minzoom: 14,
  };
};

const zoomOpacityExpression = (steps: number[], lengths: number[]): any => {
  const result: any = ["interpolate", ["linear"], ["zoom"]];

  for (const step of steps) {
    const index = steps.indexOf(step);
    const length = lengths[index];
    (result as any[]).push(step, [
      "case",
      [">", ["get", "length"], length],
      1,
      0,
    ]);
  }
  return result;
};
