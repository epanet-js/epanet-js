import type { HandlerContext } from "src/types";
import { Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { modeAtom } from "src/state/mode";
import { getMapCoord } from "src/map/map-event";
import { useSelection } from "src/selection";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import { searchNearbyRenderedFeatures } from "src/map/search";
import { clickableLayers } from "src/map/layers/layer";

import { getNode } from "src/hydraulic-model";
import { moveNode } from "src/hydraulic-model/model-operations";
import { useMoveState } from "./move-state";
import noop from "lodash/noop";
import { useElevations } from "src/map/elevations/use-elevations";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { useSnapping } from "../hooks/use-snapping";
import throttle from "lodash/throttle";
import { useClickedAsset } from "../utils";

const stateUpdateTime = 16;

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

export function useNoneHandlers({
  selection,
  idMap,
  rep,
  map,
  hydraulicModel,
}: HandlerContext): Handlers {
  const { getClickedAsset } = useClickedAsset(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const setMode = useSetAtom(modeAtom);
  const {
    clearSelection,
    isSelected,
    toggleSingleSelection,
    extendSelection,
    removeFromSelection,
    getSelectionIds,
    selectCustomerPoint,
  } = useSelection(selection);
  const { isShiftHeld } = useKeyboardState();
  const {
    setStartPoint,
    startPoint,
    updateMoveWithSnapping,
    resetMove,
    isMoving,
    startCommit,
    finishCommit,
    isCommitting,
    moveActivated,
  } = useMoveState();
  const setCursor = useSetAtom(cursorStyleAtom);
  const { fetchElevation, prefetchTile } = useElevations(
    hydraulicModel.units.elevation,
  );
  const transact = rep.useTransact();
  const { findSnappingCandidate } = useSnapping(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const fastMovePointer = (point: mapboxgl.Point) => {
    if (!map) return;

    const features = searchNearbyRenderedFeatures(map, {
      point,
      distance: 7,
      layers: clickableLayers,
    });

    const visibleFeatures = features.filter((f) => !f.state || !f.state.hidden);

    let hasClickableElement = visibleFeatures.length > 0;

    if (!hasClickableElement) {
      const pickedObjects = map.pickOverlayObjects({
        x: point.x,
        y: point.y,
        radius: 7,
      });

      for (const pickInfo of pickedObjects) {
        if (pickInfo.layer?.id === "customer-points-layer" && pickInfo.object) {
          hasClickableElement = true;
          break;
        }
      }
    }

    setCursor(hasClickableElement ? "pointer" : "");
  };

  const skipMove = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
    fastMovePointer(e.point);
  };

  const getClickedCustomerPoint = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): CustomerPoint | null => {
    const pickedObjects = map.pickOverlayObjects({
      x: e.point.x,
      y: e.point.y,
      radius: 7,
    });

    for (const pickInfo of pickedObjects) {
      if (pickInfo.layer?.id === "customer-points-layer" && pickInfo.object) {
        return pickInfo.object as CustomerPoint;
      }
    }

    return null;
  };

  const handlers: Handlers = {
    double: noop,
    down: (e) => {
      if (selection.type !== "single") {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();
      const clickedAsset = getClickedAsset(e);
      if (!clickedAsset || clickedAsset.id !== assetId) {
        return;
      }

      e.preventDefault();
      const node = getNode(hydraulicModel.assets, assetId);
      if (!node) return;

      setStartPoint(e.point);
      setCursor("move");
    },
    move: throttle(
      (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
        e.preventDefault();
        if (selection.type !== "single" || !isMoving || isCommitting) {
          return skipMove(e);
        }
        void prefetchTile(e.lngLat);

        const [assetId] = getSelectionIds();
        const asset = hydraulicModel.assets.get(assetId);
        if (!asset || asset.isLink) return;

        let newCoordinates = getMapCoord(e);
        const noElevation = 0;
        let snappingInfo: {
          pipeSnappingPosition?: [number, number];
          pipeId?: string;
          nodeSnappingId?: string;
        } = {};

        const connectedLinkIds = hydraulicModel.topology.getLinks(asset.id);
        const excludeIds = [asset.id, ...connectedLinkIds];
        const snappingCandidate = findSnappingCandidate(
          e,
          newCoordinates,
          excludeIds,
        );

        const isNodeSnapping =
          snappingCandidate && snappingCandidate.type !== "pipe";
        const isPipeSnapping =
          snappingCandidate && snappingCandidate.type === "pipe";

        setCursor(isNodeSnapping ? "not-allowed" : "move");

        if (isPipeSnapping) {
          newCoordinates = snappingCandidate.coordinates as [number, number];
          snappingInfo = {
            pipeSnappingPosition: snappingCandidate.coordinates as [
              number,
              number,
            ],
            pipeId: snappingCandidate.id,
          };
        } else if (isNodeSnapping) {
          snappingInfo = {
            nodeSnappingId: snappingCandidate.id,
          };
        }

        const { putAssets } = moveNode(hydraulicModel, {
          nodeId: asset.id,
          newCoordinates,
          newElevation: noElevation,
        });

        if (putAssets) {
          if (!moveActivated) {
            const significant =
              startPoint && isMovementSignificant(e.point, startPoint);
            if (!significant) {
              return;
            }
          }
          updateMoveWithSnapping(putAssets, snappingInfo);
        }
      },
      16,
      { trailing: false },
    ),
    up: (e) => {
      e.preventDefault();
      if (selection.type !== "single" || !isMoving) {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();
      const node = getNode(hydraulicModel.assets, assetId);
      if (!node) {
        return skipMove(e);
      }

      let newCoordinates = getMapCoord(e);
      let pipeIdToSplit: string | undefined;

      const connectedLinkIds = hydraulicModel.topology.getLinks(assetId);
      const excludeIds = [assetId, ...connectedLinkIds];
      const snappingCandidate = findSnappingCandidate(
        e,
        newCoordinates,
        excludeIds,
      );

      if (snappingCandidate && snappingCandidate.type !== "pipe") {
        clearSelection();
        resetMove();
        return;
      }

      if (snappingCandidate && snappingCandidate.type === "pipe") {
        newCoordinates = snappingCandidate.coordinates as [number, number];
        pipeIdToSplit = snappingCandidate.id;
      }

      const shouldCommit = moveActivated;

      if (shouldCommit) {
        startCommit();

        const lngLatForElevation = pipeIdToSplit
          ? ({
              lng: newCoordinates[0],
              lat: newCoordinates[1],
            } as mapboxgl.LngLat)
          : e.lngLat;

        fetchElevation(lngLatForElevation)
          .then((newElevationOrFallback) => {
            const moment = moveNode(hydraulicModel, {
              nodeId: assetId,
              newCoordinates,
              newElevation: newElevationOrFallback,
              shouldUpdateCustomerPoints: true,
              pipeIdToSplit,
            });
            transact(moment);
            resetMove();
            setTimeout(finishCommit, stateUpdateTime);
          })
          .catch(() => {
            resetMove();
            setTimeout(finishCommit, stateUpdateTime);
          });
      } else {
        resetMove();
      }
    },
    click: (e) => {
      const clickedAsset = getClickedAsset(e);
      e.preventDefault();

      if (!clickedAsset) {
        const clickedCustomerPoint = getClickedCustomerPoint(e);

        if (clickedCustomerPoint) {
          selectCustomerPoint(clickedCustomerPoint.id);
          return;
        }

        if (isShiftHeld()) return;

        clearSelection();
        resetMove();
        setMode({ mode: Mode.NONE });
        return;
      }

      if (isShiftHeld()) {
        if (isSelected(clickedAsset.id)) {
          removeFromSelection(clickedAsset.id);
        } else {
          extendSelection(clickedAsset.id);
        }
      } else {
        toggleSingleSelection(clickedAsset.id, clickedAsset.type);
      }
    },
    exit() {
      if (isMoving) {
        resetMove();
      } else {
        resetMove();
        clearSelection();
      }
    },
  };

  return handlers;
}
