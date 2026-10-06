import type { AnyLayer, Style } from "mapbox-gl";
import type { MapEngine } from "@epanet-js/map";

export const satelliteLimitedZoom = 16;

const SATELLITE_SOURCE = "mapbox-satellite";

const usesSatellite = (layer: AnyLayer): boolean =>
  "source" in layer && layer.source === SATELLITE_SOURCE;

const capLayer = (layer: AnyLayer): AnyLayer =>
  layer.type === "raster"
    ? { ...layer, paint: { ...layer.paint, "raster-resampling": "nearest" } }
    : layer;

export const withSatelliteMaxZoom = (
  style: Style,
  maxZoom: number | null,
): Style => {
  const source = style.sources[SATELLITE_SOURCE];
  if (source?.type !== "raster" || maxZoom === null) return style;

  return {
    ...style,
    sources: {
      ...style.sources,
      [SATELLITE_SOURCE]: { ...source, maxzoom: maxZoom },
    },
    layers: style.layers.map((layer) =>
      usesSatellite(layer) ? capLayer(layer) : layer,
    ),
  };
};

export const swapSatelliteMaxZoom = (
  map: MapEngine,
  baseStyle: Style,
  maxZoom: number | null,
) => {
  if (!baseStyle.sources[SATELLITE_SOURCE]) return;

  const style = withSatelliteMaxZoom(baseStyle, maxZoom);
  const satelliteLayers = style.layers
    .map((layer, i) => ({ layer, beforeId: style.layers[i + 1]?.id }))
    .filter(({ layer }) => usesSatellite(layer));

  for (const { layer } of satelliteLayers) map.map.removeLayer(layer.id);
  map.map.removeSource(SATELLITE_SOURCE);

  map.map.addSource(SATELLITE_SOURCE, style.sources[SATELLITE_SOURCE]);
  for (const { layer, beforeId } of [...satelliteLayers].reverse()) {
    map.map.addLayer(
      layer,
      beforeId && map.map.getLayer(beforeId) ? beforeId : undefined,
    );
  }
};
