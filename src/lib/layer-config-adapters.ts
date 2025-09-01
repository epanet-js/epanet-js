import { ILayerConfig } from "src/types";
import { getMapboxLayerURL, getTileJSON } from "src/lib/utils";
import mapboxgl, { RasterLayer } from "mapbox-gl";
import { notify } from "src/components/notifications";
import { LinkBreak1Icon } from "@radix-ui/react-icons";
import { Link2Off } from "lucide-react";

const warnOffline = (translate: (key: string) => string) =>
  notify({
    variant: "warning",
    Icon: isLucideIconsOn ? Link2Off : LinkBreak1Icon,
    title: translate("mapOfflineMode"),
    description: translate("mapOfflineModeExplain"),
    size: "md",
    id: "map-offline-mode",
    isLucideIconsOn: isLucideIconsOn,
  });

export async function addMapboxStyle(
  base: mapboxgl.Style,
  layer: ILayerConfig,
  translate: (key: string) => string,
): Promise<mapboxgl.Style> {
  const nextToken = layer.token;
  mapboxgl.accessToken = nextToken;

  const url = getMapboxLayerURL(layer);

  if (layer.visibility === false) {
    return base;
  }

  const style: mapboxgl.Style = await fetch(url)
    .then((res) => {
      if (!res?.ok) {
        throw new Error("Could not fetch layer");
      }
      return res.json();
    })
    .catch(() => {
      warnOffline(translate);
      return {
        version: 8,
        name: "Empty",
        sprite: "mapbox://sprites/mapbox/streets-v8",
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: {},
        layers: [],
      };
    });

  const updatedStyle = updateMapboxStyle(style, {
    visibility: layer.visibility,
    labelVisibility: layer.labelVisibility,
    rasterOpacity: layer.opacity,
  });

  Object.entries(layer.sourceMaxZoom).forEach(([sourceName, maxZoom]) => {
    (updatedStyle.sources[sourceName] as RasterLayer).maxzoom = maxZoom;
    updatedStyle.layers.forEach((layer) => {
      if ((layer as RasterLayer).source === sourceName) {
        const paint = (layer as RasterLayer).paint || {};
        paint["raster-resampling"] = "nearest";
        (layer as RasterLayer).paint = paint;
      }
    });
  });
  return updatedStyle;
}

export function paintLayoutFromRasterLayer(
  layer: ILayerConfig,
): Pick<mapboxgl.RasterLayer, "type" | "paint" | "layout"> {
  return {
    type: "raster",
    paint: {
      "raster-opacity": layer.opacity,
    },
    layout: {
      visibility: layer.visibility ? "visible" : "none",
    },
  };
}

export async function addTileJSONStyle(
  style: mapboxgl.Style,
  layer: ILayerConfig,
  id: number,
  translate: (key: string) => string,
  isLucideIconsOn: boolean,
) {
  const sourceId = `placemarkInternalSource${id}`;
  const layerId = `placemarkInternalLayer${id}`;

  try {
    const resp = await getTileJSON(layer.url);

    style.sources[sourceId] = {
      type: "raster",
      tiles: resp.tiles,
      scheme: resp.scheme || "xyz",
      tileSize: 256,
      minzoom: resp.minzoom,
      maxzoom: resp.maxzoom,
    };

    const newLayer = {
      id: layerId,
      source: sourceId,
      ...paintLayoutFromRasterLayer(layer),
    } as mapboxgl.AnyLayer;

    style.layers.push(newLayer);
  } catch (e) {
    notify({
      variant: "error",
      Icon: isLucideIconsOn ? Link2Off : LinkBreak1Icon,
      title: translate("failedToLoad"),
      description: translate("failedToLoadTileJSON"),
      size: "md",
      isLucideIconsOn: isLucideIconsOn,
    });
  }
  return style;
}

export function addXYZStyle(
  style: mapboxgl.Style,
  layer: ILayerConfig,
  id: number,
) {
  const sourceId = `placemarkInternalSource${id}`;
  const layerId = `placemarkInternalLayer${id}`;

  style.sources[sourceId] = {
    type: "raster",
    tiles: [layer.url],
    scheme: layer.tms ? "tms" : "xyz",
    tileSize: 256,
  };

  const newLayer = {
    id: layerId,
    source: sourceId,
    ...paintLayoutFromRasterLayer(layer),
  } as mapboxgl.AnyLayer;

  style.layers.push(newLayer);
  return style;
}

function updateMapboxStyle(
  style: mapboxgl.Style,
  options: {
    visibility?: boolean;
    labelVisibility?: boolean;
    rasterOpacity?: number;
  },
): mapboxgl.Style {
  const { labelVisibility = true, rasterOpacity } = options;

  if (!style.layers) {
    return style;
  }

  const isSatelliteStyle =
    style.name === "Mapbox Satellite Streets" ||
    style.name === "Mapbox Satellite";

  const updatedLayers = style.layers
    .map((layer) => {
      // Identify label layers
      const isLabelLayer =
        layer.type === "symbol" && layer.layout?.["text-field"] !== undefined;

      if (options.visibility === false) return null;

      if (!labelVisibility && isLabelLayer) {
        return null;
      }

      if (
        isSatelliteStyle &&
        layer.type === "raster" &&
        rasterOpacity !== undefined
      ) {
        return {
          ...layer,
          paint: {
            ...(layer.paint || {}),
            "raster-opacity": rasterOpacity,
          },
        };
      }

      if (isSatelliteStyle && layer.type === "background" && layer.paint) {
        return {
          ...layer,
          paint: {
            ...layer.paint,
            "background-color": "#ffffff",
          },
        };
      }

      return layer;
    })
    .filter(Boolean) as mapboxgl.AnyLayer[];

  return { ...style, layers: updatedLayers };
}
