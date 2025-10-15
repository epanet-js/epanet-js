import type { Style } from "mapbox-gl";
import { LayerConfigMap } from "src/types";
import {
  addMapboxStyle,
  addXYZStyle,
  addTileJSONStyle,
} from "src/lib/layer-config-adapters";
import { emptyFeatureCollection } from "src/lib/constants";

function getEmptyStyle() {
  const style: Style = {
    version: 8,
    name: "XYZ Layer",
    sprite: "mapbox://sprites/mapbox/streets-v8",
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sources: {},
    layers: [],
  };
  return style;
}

const emptyGeoJSONSource = {
  type: "geojson",
  data: emptyFeatureCollection,
  buffer: 4,
  tolerance: 0,
} as const;

export async function buildBaseStyle({
  layerConfigs,
  translate,
}: {
  layerConfigs: LayerConfigMap;
  translate: (key: string) => string;
}): Promise<Style> {
  let style = getEmptyStyle();
  let id = 0;
  const layers = [...layerConfigs.values()].reverse();
  for (const layer of layers) {
    id++;
    switch (layer.type) {
      case "MAPBOX": {
        style = await addMapboxStyle(style, layer, translate);
        break;
      }
      case "XYZ": {
        style = addXYZStyle(style, layer, id);
        break;
      }
      case "TILEJSON": {
        style = await addTileJSONStyle(style, layer, id, translate);
        break;
      }
    }
  }

  defineEmptySources(style);

  return style;
}

export function defineEmptySources(style: Style) {
  style.sources["imported-features"] = emptyGeoJSONSource;
  style.sources["features"] = emptyGeoJSONSource;
  style.sources["icons"] = emptyGeoJSONSource;
  style.sources["ephemeral"] = emptyGeoJSONSource;
}

export { makeLayers } from "../lib/load-and-augment-style";
