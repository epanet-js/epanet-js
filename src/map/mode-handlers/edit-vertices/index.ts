import type { HandlerContext } from "src/types";
import {
  Mode,
  ephemeralStateAtom,
  modeAtom,
  cursorStyleAtom,
} from "src/state/jotai";
import { useSetAtom, useAtom } from "jotai";
import { useSelection } from "src/selection";
import { useNoneHandlers } from "../none/none-handlers";

const searchVerticesWithTolerance = (
  map: HandlerContext["map"],
  point: mapboxgl.Point,
  distance: number = 7,
) => {
  const { x, y } = point;
  const searchBox = [
    [x - distance, y - distance] as mapboxgl.PointLike,
    [x + distance, y + distance] as mapboxgl.PointLike,
  ] as [mapboxgl.PointLike, mapboxgl.PointLike];

  return map.queryRenderedFeatures(searchBox, {
    layers: ["ephemeral-vertices"],
  });
};

export function useEditVerticesHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { selection, map } = handlerContext;
  const setMode = useSetAtom(modeAtom);
  const { clearSelection } = useSelection(selection);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);

  const defaultHandlers = useNoneHandlers(handlerContext);

  const exitEditVerticesMode = () => {
    clearSelection();
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  const handlers: Handlers = {
    click: (e) => {
      const vertexFeatures = searchVerticesWithTolerance(map, e.point);

      if (vertexFeatures.length > 0) {
        const clickedVertex = vertexFeatures[0];
        const vertexIndex = clickedVertex.properties?.vertexIndex;

        if (
          typeof vertexIndex === "number" &&
          ephemeralState.type === "editVertices"
        ) {
          setEphemeralState({
            ...ephemeralState,
            selectedVertexIndex: vertexIndex,
          });
        }
      } else {
        setMode({ mode: Mode.NONE });
        setEphemeralState({ type: "none" });
        defaultHandlers.click(e);
      }
    },
    double: () => {},
    move: (e) => {
      const vertexFeatures = searchVerticesWithTolerance(map, e.point);

      if (vertexFeatures.length > 0) {
        setCursor("pointer");
      } else {
        defaultHandlers.move(e);
      }
    },
    down: () => {},
    up: () => {},
    exit: exitEditVerticesMode,
  };

  return handlers;
}
