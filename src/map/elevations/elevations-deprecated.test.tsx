import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CanvasSetupFn,
  fetchElevationForPointDeprecated,
  prefetchElevationsTileDeprecated,
  queryClientDeprecated,
  tileSize,
} from "./elevations";
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";

const setUpCanvasFn = async (blob: Blob) => {
  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext("2d");
  const img = await loadImage(await blobToBuffer(blob));
  return { ctx, img };
};

const testCanvasFn = setUpCanvasFn as unknown as CanvasSetupFn;

describe("elevations deprecated", () => {
  afterEach(() => {
    vi.resetAllMocks();
    queryClientDeprecated.clear();
  });

  it("provides the elevation at given coordinates", async () => {
    stubFetchFixture();
    const fixtureCoordinates = { lng: -4.3808842, lat: 55.9153471 };

    const elevation = await fetchElevationForPointDeprecated(
      fixtureCoordinates,
      {
        setUpCanvas: testCanvasFn,
        unit: "m",
      },
    );

    expect(elevation).toEqual(55.6);
  });

  it("can convert to other unit", async () => {
    stubFetchFixture();
    const fixtureCoordinates = { lng: -4.3808842, lat: 55.9153471 };

    const elevation = await fetchElevationForPointDeprecated(
      fixtureCoordinates,
      {
        setUpCanvas: testCanvasFn,
        unit: "ft",
      },
    );

    expect(elevation).toBeCloseTo(182.41);
  });

  it("can provide many elevations from the same tile", async () => {
    stubFetchFixture();
    const closeCoordinates = { lng: -4.380429, lat: 55.9156107 };

    const elevation = await fetchElevationForPointDeprecated(closeCoordinates, {
      unit: "m",
      setUpCanvas: testCanvasFn,
    });

    expect(elevation).toEqual(54.3);
  });

  it("fetches one tile when coordinates are close", async () => {
    stubFetchFixture();
    const fixtureCoordinates = { lng: -4.3808842, lat: 55.9153471 };
    const closeCoordinates = { lng: -4.380429, lat: 55.9156107 };

    await fetchElevationForPointDeprecated(fixtureCoordinates, {
      unit: "m",
      setUpCanvas: testCanvasFn,
    });

    await fetchElevationForPointDeprecated(closeCoordinates, {
      unit: "m",
      setUpCanvas: testCanvasFn,
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/14/7992/5108@2x"),
    );
  });

  it("asks for tiles when not loaded", async () => {
    stubFetchFixture();
    const fixtureCoordinates = { lng: -4.3808842, lat: 55.9153471 };
    const farAwayCoordinates = { lng: +4.380429, lat: -55.9156107 };

    await fetchElevationForPointDeprecated(fixtureCoordinates, {
      unit: "m",
      setUpCanvas: testCanvasFn,
    });

    await fetchElevationForPointDeprecated(farAwayCoordinates, {
      unit: "m",
      setUpCanvas: testCanvasFn,
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/14/8391/11275@2x"),
    );
  });

  it("can prefetch tiles", async () => {
    stubFetchFixture();
    const fixtureCoordinates = { lng: -4.3808842, lat: 55.9153471 };

    await prefetchElevationsTileDeprecated(fixtureCoordinates);

    const elevation = await fetchElevationForPointDeprecated(
      fixtureCoordinates,
      {
        unit: "m",
        setUpCanvas: testCanvasFn,
      },
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(elevation).toEqual(55.6);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/14/7992/5108@2x"),
    );
  });

  it("provides fallback value when tile not found", async () => {
    stubHttpError();
    const anyCoordinates = { lng: 10, lat: 20 };

    const elevation = await fetchElevationForPointDeprecated(anyCoordinates, {
      unit: "m",
      setUpCanvas: testCanvasFn,
    });

    expect(elevation).toEqual(0);
  });
});

const stubHttpError = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: false,
      }),
    ),
  );
};

const stubFetchFixture = () => {
  const fixture = readFixtureAsBuffer();
  const blob = new Blob([fixture]);
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(blob),
      }),
    ),
  );
};

const readFixtureAsBuffer = () => {
  const buffer = fs.readFileSync(
    path.join(__dirname, "./elevations.fixture.pngraw"),
  );
  return buffer;
};

function blobToBuffer(blob: Blob): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const buffer = Buffer.from(event.target!.result as ArrayBuffer);
      resolve(buffer);
    };
    reader.onerror = function (error) {
      reject(error);
    };
    reader.readAsArrayBuffer(blob);
  });
}
