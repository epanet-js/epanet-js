import { describe, it, expect, vi, afterEach } from "vitest";
import { getEsriWktString } from "./esri-wkt";
import type { Proj4Projection } from "./projection";

const makeProjection = (id: string, code: string): Proj4Projection => ({
  type: "proj4",
  id,
  name: id,
  code,
});

describe("getEsriWktString", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches WKT from the correct projection-data URL", async () => {
    const wkt = 'PROJCS["GDA_1994_MGA_Zone_55"]';
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ wkt }), { status: 200 }),
    );

    const result = await getEsriWktString(
      makeProjection("EPSG:28355", "+proj=utm +zone=55"),
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/projection-data/epsg_28355.json",
    );
    expect(result).toBe(wkt);
  });

  it("returns the proj4 code when the fetch response is not ok", async () => {
    const code = "+proj=utm +zone=55";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );

    const result = await getEsriWktString(makeProjection("EPSG:28355", code));

    expect(result).toBe(code);
  });

  it("returns the proj4 code when the fetch throws", async () => {
    const code = "+proj=utm +zone=55";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await getEsriWktString(makeProjection("EPSG:28355", code));

    expect(result).toBe(code);
  });

  it("normalises the EPSG id to a lowercase filename", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ wkt: "WKT" }), { status: 200 }),
    );

    await getEsriWktString(makeProjection("EPSG:3857", "+proj=merc"));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/projection-data/epsg_3857.json",
    );
  });
});
