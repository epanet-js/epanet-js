import {
  fireMapClick,
  fireMapDown,
  fireMapMove,
  fireMapUp,
  getFeatureState,
  getSourceFeatures,
  stubSnapping,
} from "./__helpers__/map-engine-mock";
import { stubElevation } from "./__helpers__/elevations";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { setInitialState } from "src/__helpers__/state";
import { Mode } from "src/state/mode";
import { renderMap, matchPoint } from "./__helpers__/map";
import { vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { modeAtom } from "src/state/jotai";

describe("None mode selection", () => {
  beforeEach(() => {
    stubElevation();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("selects/unselects node when clicking close to it without moving", async () => {
    stubFeatureOn("FLAG_MAP_CLICK_FIX");
    const junctionCoords = [10, 20];
    const createClick = { lng: 10, lat: 20 };
    const nearbyClick = { lng: 10.001, lat: 20.001 };
    const anotherNearbyClick = { lng: 9.999, lat: 19.999 };

    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    await fireMapClick(map, createClick);

    await waitFor(() => {
      const features = getSourceFeatures(map, "features");
      expect(features).toHaveLength(1);
      expect(features[0]).toEqual(matchPoint({ coordinates: junctionCoords }));
    });

    const features = getSourceFeatures(map, "features");
    const junctionFeatureId = features[0].id as RawId;

    act(() => {
      store.set(modeAtom, { mode: Mode.NONE });
    });

    stubSnapping(map, [junctionFeatureId]);
    await fireMapClick(map, nearbyClick);

    await waitFor(() => {
      expect(getFeatureState(map, "features", junctionFeatureId)).toEqual({
        selected: "true",
      });
    });

    await waitFor(() => {
      const featuresAfterSelect = getSourceFeatures(map, "features");
      expect(featuresAfterSelect).toEqual([
        matchPoint({ coordinates: junctionCoords }),
      ]);
    });

    await fireMapClick(map, anotherNearbyClick);

    await waitFor(() => {
      const featuresAfterSecondClick = getSourceFeatures(map, "features");
      expect(featuresAfterSecondClick).toEqual([
        matchPoint({ coordinates: junctionCoords }),
      ]);
    });

    await waitFor(() => {
      expect(getFeatureState(map, "features", junctionFeatureId)).toEqual({
        selected: "false",
      });
    });
  });

  it.skip("moves node when performing mouse down, move, up sequence with feature flag on", async () => {
    stubFeatureOn("FLAG_MAP_CLICK_FIX");
    const junctionCoords = [10, 20];
    const createClick = { lng: 10, lat: 20 };
    const selectClick = { lng: 10.001, lat: 20.001 };
    const moveToCoords = [15, 25];
    const moveTo = { lng: 15, lat: 25 };

    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    await fireMapClick(map, createClick);

    await waitFor(() => {
      const features = getSourceFeatures(map, "features");
      expect(features).toHaveLength(1);
      expect(features[0]).toEqual(matchPoint({ coordinates: junctionCoords }));
    });

    const features = getSourceFeatures(map, "features");
    const junctionFeatureId = features[0].id as RawId;

    act(() => {
      store.set(modeAtom, { mode: Mode.NONE });
    });

    stubSnapping(map, [junctionFeatureId]);
    await fireMapClick(map, selectClick);

    await waitFor(() => {
      expect(getFeatureState(map, "features", junctionFeatureId)).toEqual({
        selected: "true",
      });
    });

    await fireMapDown(map, selectClick);
    await fireMapMove(map, moveTo);

    await waitFor(() => {
      const ephemeralFeatures = getSourceFeatures(map, "ephemeral");
      expect(ephemeralFeatures).toHaveLength(1);
      expect(ephemeralFeatures[0]).toEqual(
        matchPoint({ coordinates: moveToCoords }),
      );
    });

    await fireMapUp(map, moveTo);

    await waitFor(() => {
      const featuresAfterMove = getSourceFeatures(map, "features");
      expect(featuresAfterMove).toHaveLength(1);
      expect(featuresAfterMove[0]).toEqual(
        matchPoint({ coordinates: moveToCoords }),
      );
    });

    await waitFor(() => {
      const ephemeralFeatures = getSourceFeatures(map, "ephemeral");
      expect(ephemeralFeatures).toHaveLength(0);
    });
  });
});
