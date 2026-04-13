import { atom } from "jotai";
import type { FeatureCollection } from "geojson";

/**
 * Stores GeoJSON FeatureCollections for GEOJSON-type layers, keyed by layer ID.
 *
 * Lives in a plain Jotai atom — session-only like elevationSourcesAtom.
 * Not persisted. Keeps the actual feature data separate from layerConfigAtom
 * so that style rebuilds don't re-pass large datasets through buildBaseStyle.
 */
export const gisDataAtom = atom<Map<string, FeatureCollection>>(new Map());
