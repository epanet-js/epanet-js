import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasSetupFn, fetchElevationForPoint, tileSize } from "./elevations";
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";

const setUpCanvasFn = async (blob: Blob) => {
  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext("2d");
  const img = await loadImage(await blobToBuffer(blob));
  return { ctx, img };
};

describe("elevations", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("provides the elevation at given coordinates", async () => {
    stubFetch();
    const fixtureCoordinates = { lng: -4.3808842, lat: 55.9153471 };

    const elevation = await fetchElevationForPoint(
      fixtureCoordinates,
      setUpCanvasFn as unknown as CanvasSetupFn,
    );

    expect(elevation).toEqual(55.6);
  });

  it("can provide many elevations from the same tile", async () => {
    stubFetch();
    const closeCoordinates = { lng: -4.380429, lat: 55.9156107 };

    const elevation = await fetchElevationForPoint(
      closeCoordinates,
      setUpCanvasFn as unknown as CanvasSetupFn,
    );

    expect(elevation).toEqual(54.3);
  });
});

const stubFetch = () => {
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
