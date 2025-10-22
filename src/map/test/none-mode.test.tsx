import {
  fireMapClick,
  fireMapDown,
  fireMapMove,
  fireMapMoveSync,
  fireMapUp,
  getFeatureState,
  getSourceFeatures,
  stubSnapping,
} from "./__helpers__/map-engine-mock";
import { stubElevation } from "./__helpers__/elevations";
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

  it("selects/unselects node when clicking close", async () => {
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

  it("moves node when dragging it to a different location", async () => {
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
    await waitFor(() => {
      expect(getFeatureState(map, "features", junctionFeatureId)).toEqual({
        selected: "false",
      });
    });
  });

  it("should prevent race condition where mousemove continues after mouseup", async () => {
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

    const mouseupPromise = fireMapUp(map, moveTo);

    fireMapMoveSync(map, { lng: 16, lat: 26 });
    fireMapMoveSync(map, { lng: 17, lat: 27 });
    fireMapMoveSync(map, { lng: 18, lat: 28 });

    await mouseupPromise;
    await new Promise((resolve) => setTimeout(resolve, 1));

    const ephemeralAfterRace = getSourceFeatures(map, "ephemeral");
    expect(ephemeralAfterRace).toHaveLength(0);
    await waitFor(() => {
      const featuresAfterMove = getSourceFeatures(map, "features");
      expect(featuresAfterMove).toHaveLength(1);
      expect(featuresAfterMove[0]).toEqual(
        matchPoint({ coordinates: moveToCoords }),
      );
    });
  });

  it("does NOT show ephemeral state for tiny movements", async () => {
    const junctionCoords = [10, 20];
    const createClick = { lng: 10, lat: 20 };
    const selectClick = { lng: 10.001, lat: 20.001 };
    const tinyMove = { lng: 10.0001, lat: 20.0001 };

    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    await fireMapClick(map, createClick);

    await waitFor(() => {
      const features = getSourceFeatures(map, "features");
      expect(features).toHaveLength(1);
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
    await fireMapMove(map, tinyMove);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const ephemeralFeatures = getSourceFeatures(map, "ephemeral");
    expect(ephemeralFeatures).toHaveLength(0);

    await fireMapUp(map, tinyMove);

    await waitFor(() => {
      const featuresAfterMove = getSourceFeatures(map, "features");
      expect(featuresAfterMove).toHaveLength(1);
      expect(featuresAfterMove[0]).toEqual(
        matchPoint({ coordinates: junctionCoords }),
      );
    });
  });

  it("shows ephemeral state for significant movements", async () => {
    const createClick = { lng: 10, lat: 20 };
    const selectClick = { lng: 10.001, lat: 20.001 };
    const significantMoveCoords = [15, 25];
    const significantMove = { lng: 15, lat: 25 };

    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    await fireMapClick(map, createClick);

    await waitFor(() => {
      const features = getSourceFeatures(map, "features");
      expect(features).toHaveLength(1);
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
    await fireMapMove(map, significantMove);

    await waitFor(() => {
      const ephemeralFeatures = getSourceFeatures(map, "ephemeral");
      expect(ephemeralFeatures).toHaveLength(1);
      expect(ephemeralFeatures[0]).toEqual(
        matchPoint({ coordinates: significantMoveCoords }),
      );
    });

    await fireMapUp(map, significantMove);

    await waitFor(() => {
      const ephemeralFeatures = getSourceFeatures(map, "ephemeral");
      expect(ephemeralFeatures).toHaveLength(0);
    });

    await waitFor(() => {
      const featuresAfterMove = getSourceFeatures(map, "features");
      expect(featuresAfterMove).toHaveLength(1);
      expect(featuresAfterMove[0]).toEqual(
        matchPoint({ coordinates: significantMoveCoords }),
      );
    });
  });
});
