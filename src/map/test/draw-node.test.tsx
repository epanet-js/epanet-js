import { fireMapClick, getSourceFeatures } from "./__helpers__/map-engine-mock";
import { stubElevation } from "./__helpers__/elevations";
import { setInitialState } from "src/__helpers__/state";
import { Mode } from "src/state/mode";
import { renderMap, waitForLoaded } from "./__helpers__/map";
import { dataAtom } from "src/state/jotai";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { vi } from "vitest";

describe("Drawing a junction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates the map", async () => {
    const clickPoint = { lng: 10, lat: 20 };
    stubElevation(clickPoint, 10);
    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    fireMapClick(map, clickPoint);

    await waitForLoaded();

    const features = getSourceFeatures(map, "features");
    expect(features).toHaveLength(1);

    const feature = features[0];
    expect(feature.geometry).toEqual({
      type: "Point",
      coordinates: [10, 20],
    });
    expect(feature.properties?.type).toBe("junction");
  });

  it("registers the junction in the model", async () => {
    const clickPoint = { lng: 10, lat: 20 };
    stubElevation(clickPoint, 150);
    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    fireMapClick(map, clickPoint);

    await waitForLoaded();

    const {
      hydraulicModel: { assets },
    } = store.get(dataAtom);

    const junctions = getAssetsByType<Junction>(assets, "junction");

    expect(junctions).toHaveLength(1);

    const junction = junctions[0];
    expect(junction.coordinates).toEqual([10, 20]);
    expect(junction.elevation).toBe(150);
  });
});
