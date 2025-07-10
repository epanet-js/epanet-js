import { fireMapClick } from "./__helpers__/map-engine-mock";
import { waitFor } from "@testing-library/react";
import { setInitialState } from "src/__helpers__/state";
import { Mode } from "src/state/mode";
import { renderMap } from "./__helpers__/map";

describe("Draw node", () => {
  it("can draw a junction", async () => {
    const store = setInitialState({ mode: Mode.DRAW_JUNCTION });
    const map = await renderMap(store);

    const clickPoint = { lng: 1, lat: 1 };

    fireMapClick(map, clickPoint);

    await waitFor(() => {
      const source = map.getSource("features");
      expect(source).toBeTruthy();
    });
  });
});
