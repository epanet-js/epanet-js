/** @vitest-environment jsdom */
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { aNodeSymbology, setInitialState } from "src/__helpers__/state";
import { nullSymbologySpec } from "src/map/symbology/symbology-types";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { basemapAtom, selectBasemapAtom } from "src/state/map";
import {
  DEFAULT_MAP_THEME_ID,
  activeMapThemeIdAtom,
  defaultMapThemeSymbology,
  isMapThemeModifiedAtom,
  mapThemeActionAtom,
  mapThemesAtom,
  type MapTheme,
} from "src/state/map-themes";

const IDS = { J1: 1, J2: 2, J3: 3 } as const;

const aModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 50 })
    .aJunction(IDS.J3, { elevation: 90 })
    .build();

const anElevationTheme = (
  rule: Parameters<typeof aNodeSymbology>[0]["colorRule"] = {},
): MapTheme => ({
  id: "elevations",
  name: "Elevations",
  symbology: {
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
  },
});

const aStoreWith = (themes: MapTheme[]) => {
  const store = setInitialState({ hydraulicModel: aModel() });
  store.set(mapThemesAtom, themes);
  return store;
};

describe("applying a map theme", () => {
  it("recomputes automatic breaks from the model and keeps its colors", () => {
    const store = aStoreWith([anElevationTheme()]);

    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });

    const colorRule = store.get(nodeSymbologyAtom).colorRule!;
    expect(colorRule.breaks).toEqual([30, 60]);
    expect(colorRule.colors).toEqual(["#000001", "#000002", "#000003"]);
    expect(store.get(activeMapThemeIdAtom)).toEqual("elevations");
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);
  });

  it("keeps manual breaks", () => {
    const store = aStoreWith([
      anElevationTheme({ mode: "manual", breaks: [10, 20] }),
    ]);

    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });

    expect(store.get(nodeSymbologyAtom).colorRule!.breaks).toEqual([10, 20]);
  });

  it("keeps its number of classes when the data can't produce breaks", () => {
    const flatModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 10 })
      .aJunction(IDS.J2, { elevation: 10 })
      .build();
    const store = setInitialState({ hydraulicModel: flatModel });
    const colors = ["#1", "#2", "#3", "#4", "#5", "#6", "#7"];
    store.set(mapThemesAtom, [
      anElevationTheme({
        mode: "prettyBreaks",
        colors,
        breaks: [1, 2, 3, 4, 5, 6],
      }),
    ]);

    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });

    const colorRule = store.get(nodeSymbologyAtom).colorRule!;
    expect(colorRule.colors).toEqual(colors);
    expect(colorRule.breaks).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("unsaved theme changes", () => {
  it("are detected, reset and saved", () => {
    const store = aStoreWith([anElevationTheme()]);
    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });
    const edited = { ...nullSymbologySpec.link, labelRule: "label" };

    store.set(linkSymbologyAtom, edited);
    expect(store.get(isMapThemeModifiedAtom)).toBe(true);

    store.set(mapThemeActionAtom, { type: "resetChanges" });
    expect(store.get(linkSymbologyAtom)).toEqual(nullSymbologySpec.link);
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);

    store.set(linkSymbologyAtom, edited);
    store.set(mapThemeActionAtom, { type: "saveChanges" });
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);

    store.set(mapThemeActionAtom, { type: "apply", id: DEFAULT_MAP_THEME_ID });
    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });
    expect(store.get(linkSymbologyAtom)).toEqual(edited);
  });

  it("are not saved over the default theme", () => {
    const store = aStoreWith([]);
    store.set(linkSymbologyAtom, {
      ...nullSymbologySpec.link,
      labelRule: "label",
    });

    store.set(mapThemeActionAtom, { type: "saveChanges" });

    expect(store.get(isMapThemeModifiedAtom)).toBe(true);
  });

  it("become a new theme with save as new", () => {
    const store = aStoreWith([]);
    store.set(linkSymbologyAtom, {
      ...nullSymbologySpec.link,
      labelRule: "label",
    });

    store.set(mapThemeActionAtom, { type: "saveAsNew", name: "My theme" });

    const [theme] = store.get(mapThemesAtom);
    expect(theme.name).toEqual("My theme");
    expect(store.get(activeMapThemeIdAtom)).toEqual(theme.id);
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);
  });
});

describe("the basemap in a map theme", () => {
  it("is switched when the theme is applied", () => {
    const theme = anElevationTheme();
    const satellite = {
      style: "satellite" as const,
      visible: true,
      labels: false,
      opacity: 0.65,
    };
    const store = aStoreWith([
      { ...theme, symbology: { ...theme.symbology, basemap: satellite } },
    ]);

    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });

    expect(store.get(basemapAtom)).toEqual(satellite);
  });

  it("counts as an unsaved change when it is changed", () => {
    const store = aStoreWith([anElevationTheme()]);
    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });

    store.set(selectBasemapAtom, "outdoors");

    expect(store.get(isMapThemeModifiedAtom)).toBe(true);
  });
});

describe("deleting a map theme", () => {
  it("falls back to the default theme when it was active", () => {
    const store = aStoreWith([anElevationTheme()]);
    store.set(mapThemeActionAtom, { type: "apply", id: "elevations" });

    store.set(mapThemeActionAtom, { type: "delete", id: "elevations" });

    expect(store.get(mapThemesAtom)).toEqual([]);
    expect(store.get(activeMapThemeIdAtom)).toEqual(DEFAULT_MAP_THEME_ID);
    expect(store.get(nodeSymbologyAtom)).toEqual(nullSymbologySpec.node);
  });
});
