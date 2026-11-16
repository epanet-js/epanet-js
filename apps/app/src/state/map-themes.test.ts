/** @vitest-environment jsdom */
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { aNodeSymbology, setInitialState } from "src/__helpers__/state";
import { nullSymbologySpec } from "src/map/symbology/symbology-types";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { basemapAtom, selectBasemapAtom } from "src/state/map";
import {
  applyMapThemeSymbologyAtom,
  defaultMapThemeSymbology,
  isMapThemeModifiedAtom,
  resetMapThemeChangesAtom,
  type MapTheme,
  type MapThemeSymbology,
} from "src/state/map-themes";
import { toMapThemeSpec } from "src/lib/db/mappers/map-themes/to-rows";

const IDS = { J1: 1, J2: 2, J3: 3 } as const;

const aModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 50 })
    .aJunction(IDS.J3, { elevation: 90 })
    .build();

const anElevationTheme = (
  rule: Parameters<typeof aNodeSymbology>[0]["colorRule"] = {},
  symbology: Partial<MapThemeSymbology> = {},
): MapTheme => ({
  id: "elevations",
  name: "Elevations",
  spec: toMapThemeSpec({
    ...defaultMapThemeSymbology,
    node: aNodeSymbology({
      colorRule: {
        property: "elevation",
        mode: "equalIntervals",
        breaks: [1, 2],
        colors: ["#000001", "#000002", "#000003"],
        ...rule,
      },
    }),
    ...symbology,
  }),
});

const aStore = () => setInitialState({ hydraulicModel: aModel() });

describe("applying a map theme", () => {
  it("recomputes automatic breaks from the model and keeps its colors", () => {
    const store = aStore();

    store.set(applyMapThemeSymbologyAtom, anElevationTheme());

    const colorRule = store.get(nodeSymbologyAtom).colorRule!;
    expect(colorRule.breaks).toEqual([30, 60]);
    expect(colorRule.colors).toEqual(["#000001", "#000002", "#000003"]);
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);
  });

  it("keeps manual breaks", () => {
    const store = aStore();

    store.set(
      applyMapThemeSymbologyAtom,
      anElevationTheme({ mode: "manual", breaks: [10, 20] }),
    );

    expect(store.get(nodeSymbologyAtom).colorRule!.breaks).toEqual([10, 20]);
  });

  it("keeps its number of classes when the data can't produce breaks", () => {
    const flatModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 10 })
      .aJunction(IDS.J2, { elevation: 10 })
      .build();
    const store = setInitialState({ hydraulicModel: flatModel });
    const colors = ["#1", "#2", "#3", "#4", "#5", "#6", "#7"];

    store.set(
      applyMapThemeSymbologyAtom,
      anElevationTheme({
        mode: "prettyBreaks",
        colors,
        breaks: [1, 2, 3, 4, 5, 6],
      }),
    );

    const colorRule = store.get(nodeSymbologyAtom).colorRule!;
    expect(colorRule.colors).toEqual(colors);
    expect(colorRule.breaks).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("goes back to the default symbology without a theme", () => {
    const store = aStore();
    store.set(applyMapThemeSymbologyAtom, anElevationTheme());

    store.set(applyMapThemeSymbologyAtom, null);

    expect(store.get(nodeSymbologyAtom)).toEqual(nullSymbologySpec.node);
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);
  });

  it("drops the color rule for a property this version doesn't know", () => {
    const theme = anElevationTheme();

    const store = aStore();
    store.set(applyMapThemeSymbologyAtom, {
      ...theme,
      spec: { ...theme.spec, nodeColorBy: "futureProperty" },
    });

    expect(store.get(nodeSymbologyAtom).colorRule).toBeNull();
  });
});

describe("unsaved theme changes", () => {
  it("are detected and reset", () => {
    const store = aStore();
    store.set(applyMapThemeSymbologyAtom, anElevationTheme());

    store.set(linkSymbologyAtom, {
      ...nullSymbologySpec.link,
      labelRule: "label",
    });
    expect(store.get(isMapThemeModifiedAtom)).toBe(true);

    store.set(resetMapThemeChangesAtom);
    expect(store.get(linkSymbologyAtom)).toEqual(nullSymbologySpec.link);
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);
  });
});

describe("the basemap in a map theme", () => {
  it("is switched when the theme is applied", () => {
    const satellite = {
      style: "satellite" as const,
      visible: true,
      labels: false,
      opacity: 0.65,
    };
    const store = aStore();

    store.set(
      applyMapThemeSymbologyAtom,
      anElevationTheme({}, { basemap: satellite }),
    );

    expect(store.get(basemapAtom)).toEqual(satellite);
  });

  it("counts as an unsaved change when it is changed", () => {
    const store = aStore();
    store.set(applyMapThemeSymbologyAtom, anElevationTheme());

    store.set(selectBasemapAtom, "outdoors");

    expect(store.get(isMapThemeModifiedAtom)).toBe(true);
  });
});
