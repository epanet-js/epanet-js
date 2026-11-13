import { describe, expect, it } from "vitest";
import { mapThemeSpecSchema } from "./map-themes";

const aSpec = (overrides: Record<string, unknown> = {}) => ({
  nodeColor: "#c7d2fe",
  nodeLabel: null,
  nodeSizeMinVisibleZoom: 14,
  nodeSizeMin: 1,
  nodeSizeMax: 6,
  nodeColorBy: "pressure",
  nodeColorMode: "prettyBreaks",
  nodeColorRamp: "Temps",
  nodeColorRampReversed: false,
  nodeColors: ["#000001", "#000002", "#000003"],
  nodeBreaks: [10, 20],
  linkColor: "#312e81",
  linkLabel: null,
  linkColorBy: null,
  linkColorMode: null,
  linkColorRamp: null,
  linkColorRampReversed: null,
  linkColors: null,
  linkBreaks: null,
  zonesVisible: true,
  zonesColor: "#ea580c",
  zonesLabel: null,
  zonesColorBy: "label",
  zonesPalette: "Bold",
  customerPointsVisible: true,
  basemapStyle: "monochrome",
  basemapVisible: true,
  basemapLabels: true,
  basemapOpacity: 1,
  ...overrides,
});

describe("mapThemeSpecSchema", () => {
  it("accepts a spec with and without a color rule", () => {
    expect(mapThemeSpecSchema.safeParse(aSpec()).success).toBe(true);
  });

  it("accepts a color property it doesn't know", () => {
    expect(
      mapThemeSpecSchema.safeParse(aSpec({ nodeColorBy: "futureProperty" }))
        .success,
    ).toBe(true);
  });

  it("rejects color fields left behind without a color property", () => {
    expect(
      mapThemeSpecSchema.safeParse(aSpec({ linkColorRamp: "Temps" })).success,
    ).toBe(false);
  });

  it("rejects a color property missing its color fields", () => {
    expect(
      mapThemeSpecSchema.safeParse(aSpec({ nodeColorMode: null })).success,
    ).toBe(false);
  });

  it("rejects breaks that don't separate the colors", () => {
    expect(
      mapThemeSpecSchema.safeParse(aSpec({ nodeBreaks: [10] })).success,
    ).toBe(false);
  });
});
