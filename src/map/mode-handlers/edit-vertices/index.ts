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
import { useNoneHandlers } from "../none";
import { getMapCoord } from "src/map/map-event";
import throttle from "lodash/throttle";
import { usePersistence } from "src/lib/persistence/context";
import { updateVertices } from "src/hydraulic-model/model-operations";
import { useLinkSnapping } from "./link-snapping";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import { AssetId } from "src/hydraulic-model";
import { MapEngine } from "src/map/map-engine";

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

const calculateVertexCandidate = (
  snapPosition: Position,
  linkId: string,
  vertices: Position[],
  hydraulicModel: HandlerContext["hydraulicModel"],
): { position: Position; segmentIndex: number } | null => {
  const fullLinkCoordinates = buildLinkCoordinates(
    linkId,
    vertices,
    hydraulicModel,
  );
  if (fullLinkCoordinates.length < 2) return null;

  let closestSegmentIndex = 0;
  let minDistance = Number.MAX_VALUE;
  let projectedPoint = snapPosition;

  for (let i = 0; i < fullLinkCoordinates.length - 1; i++) {
    const segmentStart = fullLinkCoordinates[i];
    const segmentEnd = fullLinkCoordinates[i + 1];

    const segmentLineString = lineString([segmentStart, segmentEnd]);
    const snapPoint = point(snapPosition);
    const result = findNearestPointOnLine(segmentLineString, snapPoint);

    const distance = result.distance ?? Number.MAX_VALUE;
    if (distance < minDistance) {
      minDistance = distance;
      closestSegmentIndex = i;
      projectedPoint = result.coordinates;
    }
  }

  return {
    position: projectedPoint,
    segmentIndex: Math.max(0, closestSegmentIndex),
  };
};

export function useEditVerticesHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { selection, map, hydraulicModel, idMap } = handlerContext;
  const setMode = useSetAtom(modeAtom);
  const { clearSelection } = useSelection(selection);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const { findNearestLinkToSnap } = useLinkSnapping(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const defaultHandlers = useNoneHandlers(handlerContext);

  const exitEditVerticesMode = () => {
    clearSelection();
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
    setCursor("");
  };

  const handleAddNewVertex = ({
    linkId,
    vertices,
    position,
    segmentIndex,
  }: {
    linkId: AssetId;
    vertices: Position[];
    position: Position;
    segmentIndex: number;
  }) => {
    const newVertices = [...vertices];
    newVertices.splice(segmentIndex, 0, position);

    const moment = updateVertices(hydraulicModel, {
      linkId,
      newVertices,
    });
    transact(moment);

    setEphemeralState({
      type: "editVertices",
      linkId,
      vertices: newVertices,
      vertexCandidate: undefined,
    });
  };

  const getVertexAt = (
    map: MapEngine,
    point: mapboxgl.Point,
  ): number | null => {
    const vertexFeatures = searchVerticesWithTolerance(map, point);
    if (vertexFeatures.length === 0) return null;

    const vertexFeature = vertexFeatures[0];
    return vertexFeature.properties?.vertexIndex as number;
  };

  const handlers: Handlers = {
    click: (e) => {
      if (ephemeralState.type !== "editVertices") {
        defaultHandlers.click(e);
        return;
      }

      if (ephemeralState.vertexCandidate) {
        handleAddNewVertex({
          linkId: ephemeralState.linkId,
          vertices: ephemeralState.vertices,
          position: ephemeralState.vertexCandidate.position,
          segmentIndex: ephemeralState.vertexCandidate.segmentIndex,
        });
        return;
      }

      const vertexIndex = getVertexAt(map, e.point);

      if (vertexIndex !== null) {
        setEphemeralState({
          ...ephemeralState,
          selectedVertexIndex: vertexIndex,
          vertexCandidate: undefined,
        });
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
            vertexCandidate: undefined,
          });
          return;
        }

        const vertexFeatures = searchVerticesWithTolerance(map, e.point);

        const hasActualVertex = vertexFeatures.some(
          (feature) => feature.properties?.type === "vertex",
        );

        if (hasActualVertex) {
          setCursor("pointer");
          setEphemeralState({
            ...ephemeralState,
            vertexCandidate: undefined,
          });
          return;
        }

        const mouseCoord = getMapCoord(e);
        const linkSnapResult = findNearestLinkToSnap(
          e.point,
          mouseCoord,
          ephemeralState.linkId,
        );

        if (linkSnapResult && linkSnapResult.linkId === ephemeralState.linkId) {
          const vertexCandidate = calculateVertexCandidate(
            linkSnapResult.snapPosition,
            ephemeralState.linkId,
            ephemeralState.vertices,
            hydraulicModel,
          );

          if (vertexCandidate) {
            setCursor("pointer");
            setEphemeralState({
              ...ephemeralState,
              vertexCandidate,
            });
          } else {
            setEphemeralState({
              ...ephemeralState,
              vertexCandidate: undefined,
            });
            defaultHandlers.move(e);
          }
        } else {
          setEphemeralState({
            ...ephemeralState,
            vertexCandidate: undefined,
          });
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
            vertexCandidate: undefined,
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
          selectedVertexIndex: undefined,
          vertexCandidate: undefined,
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
          selectedVertexIndex: undefined,
          vertexCandidate: undefined,
        });
      }

      setCursor("");
    },
    exit: exitEditVerticesMode,
  };

  return handlers;
}
