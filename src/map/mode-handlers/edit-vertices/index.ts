import type { HandlerContext } from "src/types";
import type { Position } from "geojson";
import {
  Mode,
  ephemeralStateAtom,
  modeAtom,
  cursorStyleAtom,
} from "src/state/jotai";
import { useSetAtom, useAtom } from "jotai";
import { useSelection } from "src/selection";
import { useNoneHandlers } from "../none/none-handlers";
import { getMapCoord } from "src/map/map-event";
import throttle from "lodash/throttle";
import { usePersistence } from "src/lib/persistence/context";
import { updateVertices } from "src/hydraulic-model/model-operations";

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

const isMovementSignificant = (
  startPoint: mapboxgl.Point,
  endPoint: mapboxgl.Point,
  threshold = 5,
) => {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;

  const distanceSquared = dx * dx + dy * dy;
  const thresholdSquared = threshold * threshold;

  return distanceSquared >= thresholdSquared;
};

const buildLinkCoordinates = (
  linkId: string,
  vertices: Position[],
  hydraulicModel: HandlerContext["hydraulicModel"],
): Position[] => {
  const link = hydraulicModel.assets.get(linkId);
  if (!link || !link.isLink) return [];

  const linkAsset = link as any;
  const [startNodeId, endNodeId] = linkAsset.connections;
  const startNode = hydraulicModel.assets.get(startNodeId);
  const endNode = hydraulicModel.assets.get(endNodeId);

  if (!startNode || !endNode || startNode.isLink || endNode.isLink) return [];

  const startCoordinates = startNode.coordinates as Position;
  const endCoordinates = endNode.coordinates as Position;

  return [startCoordinates, ...vertices, endCoordinates];
};

export function useEditVerticesHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { selection, map, hydraulicModel } = handlerContext;
  const setMode = useSetAtom(modeAtom);
  const { clearSelection } = useSelection(selection);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

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
    move: throttle(
      (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
        if (ephemeralState.type !== "editVertices") {
          defaultHandlers.move(e);
          return;
        }

        if (
          ephemeralState.isDragging &&
          ephemeralState.selectedVertexIndex !== undefined
        ) {
          e.preventDefault();
          const newCoordinates = getMapCoord(e);
          const updatedVertices = [...ephemeralState.vertices];
          updatedVertices[ephemeralState.selectedVertexIndex] = newCoordinates;

          const linkCoordinates = buildLinkCoordinates(
            ephemeralState.linkId,
            updatedVertices,
            hydraulicModel,
          );

          setEphemeralState({
            ...ephemeralState,
            vertices: updatedVertices,
            linkCoordinates,
          });
          return;
        }

        const vertexFeatures = searchVerticesWithTolerance(map, e.point);

        if (vertexFeatures.length > 0) {
          setCursor("pointer");
        } else {
          defaultHandlers.move(e);
        }
      },
      16,
      { trailing: false },
    ),
    down: (e) => {
      if (ephemeralState.type !== "editVertices") return;

      const vertexFeatures = searchVerticesWithTolerance(map, e.point);

      if (vertexFeatures.length > 0) {
        const clickedVertex = vertexFeatures[0];
        const vertexIndex = clickedVertex.properties?.vertexIndex;

        if (typeof vertexIndex === "number") {
          e.preventDefault();
          const originalVertex = ephemeralState.vertices[vertexIndex];
          const linkCoordinates = buildLinkCoordinates(
            ephemeralState.linkId,
            ephemeralState.vertices,
            hydraulicModel,
          );

          setEphemeralState({
            ...ephemeralState,
            selectedVertexIndex: vertexIndex,
            isDragging: true,
            startPoint: e.point,
            originalVertexPosition: originalVertex,
            linkCoordinates,
          });

          setCursor("move");
        }
      }
    },
    up: (e) => {
      if (
        ephemeralState.type !== "editVertices" ||
        !ephemeralState.isDragging
      ) {
        return;
      }

      e.preventDefault();

      const { startPoint, originalVertexPosition, selectedVertexIndex } =
        ephemeralState;

      if (
        !startPoint ||
        originalVertexPosition === undefined ||
        selectedVertexIndex === undefined
      ) {
        return;
      }

      const significant = isMovementSignificant(e.point, startPoint);

      if (!significant && originalVertexPosition) {
        const revertedVertices = [...ephemeralState.vertices];
        revertedVertices[selectedVertexIndex] = originalVertexPosition;

        setEphemeralState({
          ...ephemeralState,
          vertices: revertedVertices,
          isDragging: false,
          startPoint: undefined,
          originalVertexPosition: undefined,
          linkCoordinates: undefined,
        });
      } else {
        const moment = updateVertices(hydraulicModel, {
          linkId: ephemeralState.linkId,
          newVertices: ephemeralState.vertices,
        });
        transact(moment);

        setEphemeralState({
          ...ephemeralState,
          isDragging: false,
          startPoint: undefined,
          originalVertexPosition: undefined,
          linkCoordinates: undefined,
        });
      }

      setCursor("");
    },
    exit: exitEditVerticesMode,
  };

  return handlers;
}
