import { fireMapClick, getSourceFeatures } from "./__helpers__/map-engine-mock";
import { setInitialState } from "src/__helpers__/state";
import { Mode } from "src/state/mode";
import { renderMap, waitForLoaded } from "./__helpers__/map";

describe("Draw node", () => {
  it("can draw a junction", async () => {
    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    const clickPoint = { lng: 10, lat: 20 };

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
});
