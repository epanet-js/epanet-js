import type mapboxgl from "mapbox-gl";
import type { Feature, FeatureCollection } from "geojson";

const METERS_PER_DEGREE = 111_319;
const DENSITY_TARGET = 30;
const TRANSITION_OFFSET = 0.65;
const BUFFER_FACTOR = 1.0;
const REGEN_THRESHOLD = 0.3;
const MAX_LINES_PER_AXIS = 300;

const OPACITY_MINOR_MIN = 0.03;
const OPACITY_MINOR_MAX = 0.35;
const WIDTH_MINOR_MIN = 0.25;
const WIDTH_MINOR_MAX = 0.75;

const MINOR_LAYER_ID = "grid-minor";

type GeneratedBounds = {
  west: number;
  east: number;
  south: number;
  north: number;
};

export class DynamicGrid {
  private map: mapboxgl.Map;
  private generatedBounds: GeneratedBounds | null = null;
  private generatedStep = 0;
  private lastMinorOpacity = -1;
  private lastMinorWidth = -1;
  private rAfPending = false;
  private moveHandler: (() => void) | null = null;

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  attach() {
    this.moveHandler = () => this.scheduleFrame();
    this.map.on("move", this.moveHandler);
    this.updateFrame();
  }

  detach() {
    if (this.moveHandler) {
      this.map.off("move", this.moveHandler);
      this.moveHandler = null;
    }
    this.clearSource();
  }

  forceUpdate() {
    this.generatedBounds = null;
    this.generatedStep = 0;
    this.lastMinorOpacity = -1;
    this.lastMinorWidth = -1;
    this.updateFrame();
  }

  private scheduleFrame() {
    if (this.rAfPending) return;
    this.rAfPending = true;
    requestAnimationFrame(() => {
      this.rAfPending = false;
      this.updateFrame();
    });
  }

  private updateFrame() {
    const { bounds, stepMeters, fraction } = calcGridParams(this.map);
    const stepChanged =
      this.generatedStep !== 0 && stepMeters !== this.generatedStep;

    if (stepChanged) {
      this.map.setPaintProperty(
        MINOR_LAYER_ID,
        "line-opacity",
        OPACITY_MINOR_MIN,
      );
      this.map.setPaintProperty(MINOR_LAYER_ID, "line-width", WIDTH_MINOR_MIN);
      this.lastMinorOpacity = OPACITY_MINOR_MIN;
      this.lastMinorWidth = WIDTH_MINOR_MIN;
    }

    if (this.shouldRegenerate(stepMeters, bounds)) {
      this.regenerateGrid(bounds, stepMeters);
    }

    if (!stepChanged) {
      const minorOpacity =
        OPACITY_MINOR_MIN + (OPACITY_MINOR_MAX - OPACITY_MINOR_MIN) * fraction;
      const minorWidth =
        WIDTH_MINOR_MIN + (WIDTH_MINOR_MAX - WIDTH_MINOR_MIN) * fraction;

      if (Math.abs(minorOpacity - this.lastMinorOpacity) > 0.004) {
        this.map.setPaintProperty(MINOR_LAYER_ID, "line-opacity", minorOpacity);
        this.lastMinorOpacity = minorOpacity;
      }
      if (Math.abs(minorWidth - this.lastMinorWidth) > 0.01) {
        this.map.setPaintProperty(MINOR_LAYER_ID, "line-width", minorWidth);
        this.lastMinorWidth = minorWidth;
      }
    }
  }

  private shouldRegenerate(
    stepMeters: number,
    bounds: mapboxgl.LngLatBounds,
  ): boolean {
    if (!this.generatedBounds || stepMeters !== this.generatedStep) return true;

    const lngMargin =
      Math.abs(bounds.getEast() - bounds.getWest()) * REGEN_THRESHOLD;
    const latMargin =
      Math.abs(bounds.getNorth() - bounds.getSouth()) * REGEN_THRESHOLD;

    return (
      bounds.getWest() < this.generatedBounds.west + lngMargin ||
      bounds.getEast() > this.generatedBounds.east - lngMargin ||
      bounds.getSouth() < this.generatedBounds.south + latMargin ||
      bounds.getNorth() > this.generatedBounds.north - latMargin
    );
  }

  private regenerateGrid(bounds: mapboxgl.LngLatBounds, stepMeters: number) {
    const stepDeg = stepMeters / METERS_PER_DEGREE;

    const lngSpan = bounds.getEast() - bounds.getWest();
    const latSpan = bounds.getNorth() - bounds.getSouth();

    const west = bounds.getWest() - lngSpan * BUFFER_FACTOR;
    const east = bounds.getEast() + lngSpan * BUFFER_FACTOR;
    const south = Math.max(
      -85.051,
      bounds.getSouth() - latSpan * BUFFER_FACTOR,
    );
    const north = Math.min(85.051, bounds.getNorth() + latSpan * BUFFER_FACTOR);

    this.generatedBounds = { west, east, south, north };
    this.generatedStep = stepMeters;

    const startLng = Math.floor(west / stepDeg);
    const endLng = Math.ceil(east / stepDeg);
    const startLat = Math.floor(south / stepDeg);
    const endLat = Math.ceil(north / stepDeg);

    const totalLines = endLng - startLng + (endLat - startLat);
    if (totalLines > MAX_LINES_PER_AXIS * 2) return;

    const features: Feature[] = [];

    for (let i = startLng; i <= endLng; i++) {
      const lng = i * stepDeg;
      features.push({
        type: "Feature",
        properties: { rank: i % 10 === 0 ? "major" : "minor" },
        geometry: {
          type: "LineString",
          coordinates: [
            [lng, south],
            [lng, north],
          ],
        },
      });
    }

    for (let i = startLat; i <= endLat; i++) {
      const lat = i * stepDeg;
      if (lat < -85.051 || lat > 85.051) continue;
      features.push({
        type: "Feature",
        properties: { rank: i % 10 === 0 ? "major" : "minor" },
        geometry: {
          type: "LineString",
          coordinates: [
            [west, lat],
            [east, lat],
          ],
        },
      });
    }

    const source = this.map.getSource("grid") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features,
      } as FeatureCollection);
    }
  }

  private clearSource() {
    const source = this.map.getSource("grid") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }
}

function calcGridParams(map: mapboxgl.Map) {
  const bounds = map.getBounds();
  const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
  const viewWidthMeters = lngSpan * METERS_PER_DEGREE;
  const idealStep = viewWidthMeters / DENSITY_TARGET;

  const exponent = Math.log10(idealStep);
  const snappedExp = Math.floor(exponent + TRANSITION_OFFSET);
  const stepMeters = Math.pow(10, snappedExp);

  const bandTop = snappedExp + (1 - TRANSITION_OFFSET);
  const fraction = Math.max(0, Math.min(1, bandTop - exponent));

  return { bounds, stepMeters, fraction };
}
