import { describe, it, expect } from "vitest";
import { validate } from "@mapbox/mapbox-gl-style-spec";
import { makeLayers } from "./build-style";
import { SYMBOLIZATION_NONE } from "src/types";
import { nullSymbologySpec } from "src/map/symbology";

// Mapbox rejects an invalid paint/layout expression at setStyle time and drops the whole
// style — the map never renders. Nothing else in the suite catches that: the map is mocked
// everywhere, so a layer is only ever built, never validated. Run the real spec validator.
const validateLayers = (layers: unknown[]): { message: string }[] => {
  const sources = Object.fromEntries(
    [
      "main-features",
      "delta-features",
      "icons",
      "delta-icons",
      "ephemeral",
      "map-overlay",
      "highlights",
      "grid",
      "zones",
    ].map((id) => [
      id,
      { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    ]),
  );

  // glyphs/sprite come from the real base style these layers are pushed onto; without
  // them the validator flags every text-field for a problem the app doesn't have.
  return validate({
    version: 8,
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sprite: "mapbox://sprites/mapbox/streets-v12",
    sources,
    layers,
  } as never) as { message: string }[];
};

describe("makeLayers", () => {
  it("builds layers mapbox accepts", () => {
    const layers = makeLayers({
      symbology: SYMBOLIZATION_NONE,
      previewProperty: null,
      nodeDefaults: nullSymbologySpec.node.defaults,
      linkDefaults: nullSymbologySpec.link.defaults,
    });

    expect(validateLayers(layers)).toEqual([]);
  });

  it("keeps zoom as the direct input of the arrow opacity interpolate", () => {
    const layers = makeLayers({
      symbology: SYMBOLIZATION_NONE,
      previewProperty: null,
      nodeDefaults: nullSymbologySpec.node.defaults,
      linkDefaults: nullSymbologySpec.link.defaults,
    });
    const arrows = layers.find(
      (layer) => layer.id === "main-features-pipe-arrows",
    ) as unknown as { paint: Record<string, unknown> };

    // Reading feature state (`hidden`) has to happen in the interpolate's output branches;
    // wrapping the interpolate to do it is what mapbox rejects.
    const opacity = arrows.paint["icon-opacity"] as unknown[];
    expect(opacity[0]).toBe("interpolate");
    expect(opacity[2]).toEqual(["zoom"]);
  });
});
