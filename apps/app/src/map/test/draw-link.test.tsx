import { triggerShortcut, stubKeyboardState } from "src/__helpers__/keyboard";
import {
  fireDoubleClick,
  fireMapClick,
  fireMapMove,
  getSourceFeatures,
  stubSnapping,
  stubSnappingOnce,
  type MapTestEngine,
} from "./__helpers__/map-engine-mock";
import { stubElevation } from "./__helpers__/elevations";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Mode } from "src/state/mode";
import { matchLineString, matchPoint, renderMap } from "./__helpers__/map";
import { vi } from "vitest";
import mapboxgl from "mapbox-gl";
import { act } from "react";
import { waitFor } from "@testing-library/react";
import { Asset, LinkAsset } from "src/hydraulic-model";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { buildFeatureId } from "../data-source/features";
import type { ClickEvent } from "../types";
import * as modelOperations from "src/hydraulic-model/model-operations";

// Spy on addLink so we can count how many times a single finishing gesture
// submits. The model ends up identical whether or not the double-submit
// happens (the buggy second submit throws before mutating anything), so the
// only observable signal of the regression is addLink running twice.
vi.mock("src/hydraulic-model/model-operations", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("src/hydraulic-model/model-operations")
    >();
  return { ...actual, addLink: vi.fn(actual.addLink) };
});

const clickEventAt = (
  map: MapTestEngine,
  point: { lng: number; lat: number },
): ClickEvent =>
  ({
    lngLat: new mapboxgl.LngLat(point.lng, point.lat),
    point: new mapboxgl.Point(point.lng * 100, point.lat * 100),
    originalEvent: new MouseEvent("click"),
    target: map.map,
    type: "click",
    preventDefault: () => {},
    defaultPrevented: false,
  }) as unknown as ClickEvent;

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
      expect(getSourceFeatures(map, "delta-features")).toEqual([
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
      expect(getSourceFeatures(map, "delta-features")).toEqual([
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
      expect(getSourceFeatures(map, "delta-features")).toEqual([
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
      expect(getSourceFeatures(map, "delta-features")).toEqual([
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
      expect(getSourceFeatures(map, "delta-features")).toEqual([
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

  it("submits only once when a finishing double-click also fires a click", async () => {
    const IDS = { P1: 1, J1: 2, J2: 3, J3: 4 } as const;
    const startOnPipe = { lng: 5, lat: 0 };
    const endOnNode = { lng: 10, lat: 10 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [10, 10] })
      .build();

    const store = setInitialState({ mode: Mode.DRAW_PIPE, hydraulicModel });
    const map = await renderMap(store);

    // Start the link by snapping onto the existing pipe, which stores its id as
    // startPipeId in the drawing state.
    stubSnapping(map, [buildFeatureId(IDS.P1)]);
    await fireMapClick(map, startOnPipe);

    // Move the cursor to the end so the drawn link has a non-zero length.
    stubSnapping(map, [buildFeatureId(IDS.J3)]);
    await fireMapMove(map, endOnNode);

    // Wait until the in-progress drawing has rendered, which guarantees
    // handlers.current closes over it before we fire the finishing gesture.
    await waitFor(() => {
      expect(
        getSourceFeatures(map, "ephemeral").some(
          (feature) => feature.geometry.type === "LineString",
        ),
      ).toBe(true);
    });

    // A real double-click on the end node fires `click` then `dblclick`. Both
    // read the same (not-yet-re-rendered) drawing closure, so without the guard
    // both submit and the second re-splits the already-deleted start pipe.
    // Drive both handlers directly, in the same tick, to recreate that race.
    await act(async () => {
      map.handlers.current.onClick(clickEventAt(map, endOnNode));
      map.handlers.current.onDoubleClick(clickEventAt(map, endOnNode));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(modelOperations.addLink).toHaveBeenCalledTimes(1);

    // The link was actually created: the end node is now connected.
    const model = store.get(stagingModelAtom);
    const linksOnEndNode = [...model.assets.values()].filter(
      (asset): asset is LinkAsset =>
        asset.isLink && (asset as LinkAsset).connections.includes(IDS.J3),
    );
    expect(linksOnEndNode).toHaveLength(1);
  });
});
