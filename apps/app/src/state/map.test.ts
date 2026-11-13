import { createStore } from "jotai";
import { aLayerConfig } from "src/__helpers__/state";
import {
  applyLayerConfigChangesAtom,
  basemapAtom,
  layerConfigAtom,
  selectBasemapAtom,
} from "src/state/map";

const drawnLayerNames = (store: ReturnType<typeof createStore>) =>
  [...store.get(layerConfigAtom).values()].map((l) => l.name);

const aCustomStyle = () =>
  aLayerConfig({ id: "custom", name: "My style", type: "MAPBOX" });

describe("map layers", () => {
  it("draws the basemap below the custom layers", () => {
    const store = createStore();

    store.set(applyLayerConfigChangesAtom, {
      putLayerConfigs: [
        aLayerConfig({ id: "xyz", name: "Tiles", type: "XYZ", at: "a1" }),
      ],
    });

    expect(drawnLayerNames(store)).toEqual(["Tiles", "Monochrome"]);
  });

  it("draws a custom style instead of the basemap until it is removed", () => {
    const store = createStore();

    store.set(applyLayerConfigChangesAtom, {
      putLayerConfigs: [aCustomStyle()],
    });
    expect(drawnLayerNames(store)).toEqual(["My style"]);

    store.set(applyLayerConfigChangesAtom, { deleteLayerConfigs: ["custom"] });
    expect(drawnLayerNames(store)).toEqual(["Monochrome"]);
  });

  it("replaces a custom style when a basemap is selected", () => {
    const store = createStore();
    store.set(applyLayerConfigChangesAtom, {
      putLayerConfigs: [{ ...aCustomStyle(), labelVisibility: false }],
    });

    store.set(selectBasemapAtom, "satellite");

    expect(drawnLayerNames(store)).toEqual(["Satellite"]);
    expect(store.get(basemapAtom)).toEqual({
      style: "satellite",
      visible: true,
      labels: false,
      opacity: 0.65,
    });
  });

  it("keeps changes made to the basemap row", () => {
    const store = createStore();
    const [basemapLayer] = store.get(layerConfigAtom).values();

    store.set(applyLayerConfigChangesAtom, {
      putLayerConfigs: [{ ...basemapLayer, visibility: false, opacity: 0.4 }],
    });

    expect(store.get(basemapAtom)).toEqual({
      style: "monochrome",
      visible: false,
      labels: true,
      opacity: 0.4,
    });
  });
});
