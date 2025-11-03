import { triggerShortcut, stubKeyboardState } from "src/__helpers__/keyboard";
import {
  fireDoubleClick,
  fireMapClick,
  fireMapMove,
  getSourceFeatures,
  stubSnappingOnce,
} from "./__helpers__/map-engine-mock";
import { stubElevation } from "./__helpers__/elevations";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Mode } from "src/state/mode";
import { matchLineString, matchPoint, renderMap } from "./__helpers__/map";
import { vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { Asset } from "src/hydraulic-model";
import { buildFeatureId } from "../data-source/features";

describe("Drawing a pipe", () => {
  beforeEach(() => {
    stubElevation();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates link and two nodes when all new", async () => {
    const firstClick = { lng: 10, lat: 20 };
    const movePoint = { lng: 20, lat: 30 };
    const secondClick = { lng: 30, lat: 40 };
    const thirdClick = { lng: 40, lat: 50 };

    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const map = await renderMap(store);

    await fireMapClick(map, firstClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [10, 20],
          ],
        }),
      ]);
    });

    await fireMapMove(map, movePoint);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [20, 30],
          ],
        }),
      ]);
    });

    await fireMapMove(map, secondClick);
    await fireMapClick(map, secondClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [30, 40],
            [30, 40], //to fix
          ],
        }),
      ]);
    });

    await fireMapMove(map, thirdClick);
    await fireDoubleClick(map, thirdClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "features")).toEqual([
        matchLineString({
          coordinates: [
            [10, 20],
            [30, 40],
            [40, 50],
          ],
        }),
        matchPoint({ coordinates: [10, 20] }),
        matchPoint({ coordinates: [40, 50] }),
      ]);
    });

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
    });
  });

  it("snaps to existing starting node", async () => {
    const IDS = { J1: 10 } as const;
    const existingNodeCoords = [15, 25];
    const nearbyClick = { lng: 15.001, lat: 25.001 };
    const movePoint = { lng: 35, lat: 45 };
    const endClick = { lng: 50, lat: 60 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: existingNodeCoords })
      .build();
    const junction = hydraulicModel.assets.get(IDS.J1) as Asset;

    const store = setInitialState({
      mode: Mode.DRAW_PIPE,
      hydraulicModel,
    });
    const map = await renderMap(store);

    stubSnappingOnce(map, [buildFeatureId(junction.id)]);

    await fireMapClick(map, nearbyClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: existingNodeCoords }),
        matchLineString({
          coordinates: [existingNodeCoords, existingNodeCoords],
        }),
      ]);
    });

    await fireMapMove(map, movePoint);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: existingNodeCoords }),
        matchLineString({
          coordinates: [existingNodeCoords, [35, 45]],
        }),
      ]);
    });

    await fireMapMove(map, endClick);
    await fireDoubleClick(map, endClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "features")).toEqual([
        matchLineString({
          coordinates: [existingNodeCoords, [50, 60]],
        }),
        matchPoint({ coordinates: existingNodeCoords }),
        matchPoint({ coordinates: [50, 60] }),
      ]);
    });

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
    });
  });

  it("snaps to existing end node", async () => {
    const IDS = { J1: 10 } as const;
    const firstClick = { lng: 10, lat: 20 };
    const movePoint = { lng: 35, lat: 45 };
    const existingNodeCoords = [50, 60];
    const nearbyEndClick = { lng: 50.001, lat: 60.001 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: existingNodeCoords })
      .build();
    const junction = hydraulicModel.assets.get(IDS.J1) as Asset;

    const store = setInitialState({
      mode: Mode.DRAW_PIPE,
      hydraulicModel,
    });
    const map = await renderMap(store);

    await fireMapClick(map, firstClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [10, 20],
          ],
        }),
      ]);
    });

    await fireMapMove(map, movePoint);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [35, 45],
          ],
        }),
      ]);
    });

    stubSnappingOnce(map, [buildFeatureId(junction.id)]);
    await fireMapMove(map, nearbyEndClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: existingNodeCoords }),
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [[10, 20], existingNodeCoords],
        }),
      ]);
    });

    await fireDoubleClick(map, nearbyEndClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "features")).toEqual([
        matchLineString({
          coordinates: [[10, 20], existingNodeCoords],
        }),
        matchPoint({ coordinates: [10, 20] }),
        matchPoint({ coordinates: existingNodeCoords }),
      ]);
    });

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
    });
  });

  it("cancels drawing when pressing escape", async () => {
    const firstClick = { lng: 10, lat: 20 };
    const movePoint = { lng: 35, lat: 45 };

    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const map = await renderMap(store);

    await fireMapClick(map, firstClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [10, 20],
          ],
        }),
      ]);
    });

    await fireMapMove(map, movePoint);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [35, 45],
          ],
        }),
      ]);
    });

    triggerShortcut("esc");

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
    });
  });

  it("creates two connected links when using control+click", async () => {
    const firstClick = { lng: 10, lat: 20 };
    const secondClick = { lng: 30, lat: 40 };
    const thirdClick = { lng: 50, lat: 60 };

    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const map = await renderMap(store);

    await fireMapClick(map, firstClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [10, 20] }),
        matchLineString({
          coordinates: [
            [10, 20],
            [10, 20],
          ],
        }),
      ]);
    });

    await fireMapMove(map, secondClick);
    stubKeyboardState({ ctrl: true });
    await fireMapClick(map, secondClick);
    stubKeyboardState({ ctrl: false });

    await waitFor(() => {
      expect(getSourceFeatures(map, "features")).toEqual([
        matchLineString({
          coordinates: [
            [10, 20],
            [30, 40],
          ],
        }),
        matchPoint({ coordinates: [10, 20] }),
        matchPoint({ coordinates: [30, 40] }),
      ]);
    });

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toEqual([
        matchPoint({ coordinates: [30, 40] }),
        matchLineString({
          coordinates: [
            [30, 40],
            [30, 40],
          ],
        }),
      ]);
    });

    await fireMapMove(map, thirdClick);

    await fireDoubleClick(map, thirdClick);

    await waitFor(() => {
      expect(getSourceFeatures(map, "features")).toEqual([
        matchLineString({
          coordinates: [
            [10, 20],
            [30, 40],
          ],
        }),
        matchPoint({ coordinates: [10, 20] }),
        matchPoint({ coordinates: [30, 40] }),
        matchLineString({
          coordinates: [
            [30, 40],
            [50, 60],
          ],
        }),
        matchPoint({ coordinates: [50, 60] }),
      ]);
    });

    await waitFor(() => {
      expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
    });
  });
});
