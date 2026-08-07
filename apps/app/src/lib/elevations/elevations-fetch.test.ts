import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultElevationEngine,
  type ElevationEngine,
  type TileServerElevationSource,
} from "@epanet-js/elevations";
import { getElevationEngine, registerElevationEngine } from "./index";

const aTileServerSource: TileServerElevationSource = {
  type: "tile-server",
  id: "tiles",
  enabled: true,
  tileUrlTemplate: "https://example.com/{z}/{x}/{y}",
  tileZoom: 14,
  tileSize: 512,
  encoding: "terrain-rgb",
  elevationOffsetM: 0,
};

const points = [
  { lng: -3.5, lat: 55.5 },
  { lng: -3.6, lat: 55.6 },
];

describe("fetching elevations through the registered engine", () => {
  const registered = getElevationEngine();

  afterEach(() => {
    registerElevationEngine(registered);
  });

  it("delegates a single point to the engine", async () => {
    const fetchElevation = vi.fn().mockResolvedValue(42);
    registerElevationEngine({
      ...defaultElevationEngine,
      fetchElevation,
    } as ElevationEngine);

    const result = await getElevationEngine().fetchElevation(
      [aTileServerSource],
      -3.5,
      55.5,
      "m",
    );

    expect(result).toBe(42);
    expect(fetchElevation).toHaveBeenCalledWith(
      [aTileServerSource],
      -3.5,
      55.5,
      "m",
    );
  });

  it("delegates a batch to the engine", async () => {
    const fetchElevations = vi.fn().mockResolvedValue([10, 20]);
    registerElevationEngine({
      ...defaultElevationEngine,
      fetchElevations,
    } as ElevationEngine);

    const result = await getElevationEngine().fetchElevations(
      [aTileServerSource],
      points,
      "m",
    );

    expect(result).toEqual([10, 20]);
  });

  describe("an engine that resolves points one at a time", () => {
    beforeEach(() => {
      registerElevationEngine(defaultElevationEngine);
    });

    it("leaves every point of a batch unresolved", async () => {
      const result = await getElevationEngine().fetchElevations(
        [aTileServerSource],
        points,
        "m",
      );

      expect(result).toEqual([null, null]);
    });

    it("reports that it cannot read GeoTIFF sources", () => {
      expect(getElevationEngine().supportsGeoTiff).toBe(false);
    });
  });
});
