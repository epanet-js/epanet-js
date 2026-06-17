import { fireMapClick, getSourceFeatures } from "./__helpers__/map-engine-mock";
import { stubElevation } from "./__helpers__/elevations";
import { setInitialState } from "src/__helpers__/state";
import { Mode } from "src/state/mode";
import { renderMap } from "./__helpers__/map";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { Junction } from "@epanet-js/hydraulic-model";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { vi } from "vitest";
import { waitFor } from "@testing-library/react";

describe("Drawing a junction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates the map", async () => {
    const clickPoint = { lng: 10, lat: 20 };
    stubElevation(clickPoint, 10);
    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    await fireMapClick(map, clickPoint);

    await waitFor(() => {
      const features = getSourceFeatures(map, "delta-features");
      expect(features).toHaveLength(1);

      const feature = features[0];
      expect(feature.geometry).toEqual({
        type: "Point",
        coordinates: [10, 20],
      });
      expect(feature.properties?.type).toBe("junction");
    });
  });

  it("registers the junction in the model and selects it", async () => {
    const clickPoint = { lng: 10, lat: 20 };
    stubElevation(clickPoint, 150);
    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    await fireMapClick(map, clickPoint);

    const { assets } = store.get(stagingModelAtom);

    const junctions = getAssetsByType<Junction>(assets, "junction");

    expect(junctions).toHaveLength(1);

    const junction = junctions[0];
    expect(junction.coordinates).toEqual([10, 20]);
    expect(junction.elevation).toBe(150);

    await waitFor(() => {
      const selection = store.get(selectionAtom);
      expect(USelection.isSingleAsset(selection)).toBe(true);
      expect(USelection.singleAssetId(selection)).toBe(junction.id);
    });
  });
});
