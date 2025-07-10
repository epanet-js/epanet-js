import {
  fireDoubleClick,
  fireMapClick,
  fireMapMove,
  getSourceFeatures,
} from "./__helpers__/map-engine-mock";
import { stubElevation } from "./__helpers__/elevations";
import { setInitialState } from "src/__helpers__/state";
import { Mode } from "src/state/mode";
import {
  matchLineString,
  matchPoint,
  renderMap,
  waitForLoaded,
} from "./__helpers__/map";
import { vi } from "vitest";

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

    expect(getSourceFeatures(map, "ephemeral-state")).toEqual([
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

    expect(getSourceFeatures(map, "ephemeral-state")).toEqual([
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

    expect(getSourceFeatures(map, "ephemeral-state")).toHaveLength(0);
  });
});
