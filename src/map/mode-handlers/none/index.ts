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
import { QueryProvider, getClickedFeature } from "src/map/fuzzy-click";
import { decodeId } from "src/lib/id";
import { UIDMap } from "src/lib/id-mapper";
import { Asset } from "src/hydraulic-model";
import { useElevations } from "src/map/elevations/use-elevations";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { CustomerPoint } from "src/hydraulic-model/customer-points";

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
  const setMode = useSetAtom(modeAtom);
  const isCustomerPointOn = useFeatureFlag("FLAG_CUSTOMER_POINT");
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
    updateMove,
    resetMove,
    isMoving,
    startCommit,
    finishCommit,
    isCommitting,
  } = useMoveState();
  const setCursor = useSetAtom(cursorStyleAtom);
  const { fetchElevation, prefetchTile } = useElevations(
    hydraulicModel.units.elevation,
  );
  const transact = rep.useTransact();

  const fastMovePointer = (point: mapboxgl.Point) => {
    if (!map) return;

    const features = searchNearbyRenderedFeatures(map, {
      point,
      distance: 7,
      layers: clickableLayers,
    });

    const visibleFeatures = features.filter((f) => !f.state || !f.state.hidden);

    let hasClickableElement = visibleFeatures.length > 0;

    if (!hasClickableElement && isCustomerPointOn) {
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

  const getClickedAsset = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): Asset | null => {
    const rawId = getClickedFeature(map as QueryProvider, e.point);
    if (rawId === null) return null;

    const decodedId = decodeId(rawId);
    const uuid = UIDMap.getUUID(idMap, decodedId.featureId);

    const asset = hydraulicModel.assets.get(uuid);
    if (!asset) return null;

    return asset;
  };

  const getClickedCustomerPoint = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): CustomerPoint | null => {
    if (!isCustomerPointOn) return null;

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
    move: (e) => {
      e.preventDefault();
      if (selection.type !== "single" || !isMoving || isCommitting) {
        return skipMove(e);
      }
      void prefetchTile(e.lngLat);

      const [assetId] = getSelectionIds();
      const asset = hydraulicModel.assets.get(assetId);
      if (!asset || asset.isLink) return;

      const newCoordinates = getMapCoord(e);
      const noElevation = 0;
      const { putAssets } = moveNode(hydraulicModel, {
        nodeId: asset.id,
        newCoordinates,
        newElevation: noElevation,
      });
      putAssets && updateMove(putAssets);
    },
    up: async (e) => {
      e.preventDefault();
      if (selection.type !== "single" || !isMoving) {
        return skipMove(e);
      }

      const [assetId] = getSelectionIds();
      const node = getNode(hydraulicModel.assets, assetId);
      if (!node) {
        return skipMove(e);
      }

      const newCoordinates = getMapCoord(e);
      const significant =
        startPoint && isMovementSignificant(e.point, startPoint);

      if (significant) {
        startCommit();
        const moment = moveNode(hydraulicModel, {
          nodeId: assetId,
          newCoordinates,
          newElevation: await fetchElevation(e.lngLat),
          updateCustomerPoints: isCustomerPointOn,
        });
        transact(moment);
        clearSelection();
        finishCommit();
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
      resetMove();
      clearSelection();
    },
  };

  return handlers;
}
