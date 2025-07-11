import { triggerShortcut, stubKeyboardState } from "src/__helpers__/shortcuts";
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
import {
  matchLineString,
  matchPoint,
  renderMap,
  waitForLoaded,
} from "./__helpers__/map";
import { vi } from "vitest";
import { Asset } from "src/hydraulic-model";
import { buildFeatureId } from "../data-source/features";
import { UIDMap } from "src/lib/id-mapper";

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

    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const map = await renderMap(store);

    fireMapClick(map, firstClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [
          [10, 20],
          [10, 20],
        ],
      }),
    ]);

    fireMapMove(map, movePoint);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [
          [10, 20],
          [20, 30],
        ],
      }),
    ]);

    fireMapMove(map, secondClick);
    await waitForLoaded();
    fireDoubleClick(map, secondClick);
    await waitForLoaded();

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

    expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
  });

  it("snaps to existing starting node", async () => {
    const existingNodeCoords = [15, 25];
    const nearbyClick = { lng: 15.001, lat: 25.001 };
    const movePoint = { lng: 35, lat: 45 };
    const endClick = { lng: 50, lat: 60 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: existingNodeCoords })
      .build();
    const junction = hydraulicModel.assets.get("J1") as Asset;
    const idMap = UIDMap.empty();
    UIDMap.pushUUID(idMap, junction.id);

    const store = setInitialState({
      mode: Mode.DRAW_PIPE,
      hydraulicModel,
    });
    const map = await renderMap(store, idMap);

    stubSnappingOnce(map, [buildFeatureId(idMap, junction.id)]);

    fireMapClick(map, nearbyClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: existingNodeCoords }),
      matchLineString({
        coordinates: [existingNodeCoords, existingNodeCoords],
      }),
    ]);

    fireMapMove(map, movePoint);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: existingNodeCoords }),
      matchLineString({
        coordinates: [existingNodeCoords, [35, 45]],
      }),
    ]);

    fireMapMove(map, endClick);
    await waitForLoaded();
    fireDoubleClick(map, endClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "features")).toEqual([
      matchLineString({
        coordinates: [existingNodeCoords, [50, 60]],
      }),
      matchPoint({ coordinates: existingNodeCoords }),
      matchPoint({ coordinates: [50, 60] }),
    ]);

    expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
  });

  it("snaps to existing end node", async () => {
    const firstClick = { lng: 10, lat: 20 };
    const movePoint = { lng: 35, lat: 45 };
    const existingNodeCoords = [50, 60];
    const nearbyEndClick = { lng: 50.001, lat: 60.001 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: existingNodeCoords })
      .build();
    const junction = hydraulicModel.assets.get("J1") as Asset;
    const idMap = UIDMap.empty();
    UIDMap.pushUUID(idMap, junction.id);

    const store = setInitialState({
      mode: Mode.DRAW_PIPE,
      hydraulicModel,
    });
    const map = await renderMap(store, idMap);

    fireMapClick(map, firstClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [
          [10, 20],
          [10, 20],
        ],
      }),
    ]);

    fireMapMove(map, movePoint);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [
          [10, 20],
          [35, 45],
        ],
      }),
    ]);

    stubSnappingOnce(map, [buildFeatureId(idMap, junction.id)]);
    fireMapMove(map, nearbyEndClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: existingNodeCoords }),
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [[10, 20], existingNodeCoords],
      }),
    ]);

    fireDoubleClick(map, nearbyEndClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "features")).toEqual([
      matchLineString({
        coordinates: [[10, 20], existingNodeCoords],
      }),
      matchPoint({ coordinates: [10, 20] }),
      matchPoint({ coordinates: existingNodeCoords }),
    ]);

    expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
  });

  it("cancels drawing when pressing escape", async () => {
    const firstClick = { lng: 10, lat: 20 };
    const movePoint = { lng: 35, lat: 45 };

    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const map = await renderMap(store);

    fireMapClick(map, firstClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [
          [10, 20],
          [10, 20],
        ],
      }),
    ]);

    fireMapMove(map, movePoint);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [
          [10, 20],
          [35, 45],
        ],
      }),
    ]);

    triggerShortcut("esc");
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
  });

  it("creates two connected links when using control+click", async () => {
    const firstClick = { lng: 10, lat: 20 };
    const secondClick = { lng: 30, lat: 40 };
    const thirdClick = { lng: 50, lat: 60 };

    const store = setInitialState({ mode: Mode.DRAW_PIPE });
    const map = await renderMap(store);

    fireMapClick(map, firstClick);
    await waitForLoaded();

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [10, 20] }),
      matchLineString({
        coordinates: [
          [10, 20],
          [10, 20],
        ],
      }),
    ]);

    fireMapMove(map, secondClick);
    await waitForLoaded();
    stubKeyboardState({ ctrl: true });
    fireMapClick(map, secondClick);
    await waitForLoaded();
    stubKeyboardState({ ctrl: false });

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

    expect(getSourceFeatures(map, "ephemeral")).toEqual([
      matchPoint({ coordinates: [30, 40] }),
      matchLineString({
        coordinates: [
          [30, 40],
          [30, 40],
        ],
      }),
    ]);

    fireMapMove(map, thirdClick);
    await waitForLoaded();

    fireDoubleClick(map, thirdClick);
    await waitForLoaded();

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

    expect(getSourceFeatures(map, "ephemeral")).toHaveLength(0);
  });
});
