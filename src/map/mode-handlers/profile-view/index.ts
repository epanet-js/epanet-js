import { useRef } from "react";
import throttle from "lodash/throttle";
import { useAtomValue, useSetAtom } from "jotai";
import { HandlerContext } from "src/types";
import { profileViewAtom } from "src/state/profile-view";
import { dialogAtom } from "src/state/dialog";
import { DraftPath, ephemeralStateAtom } from "src/state/drawing";
import { cursorStyleAtom } from "src/state/map";
import { selectionAtom } from "src/state/selection";
import { SELECTION_NONE } from "src/selection/selection";
import { Asset, AssetId, LinkAsset } from "src/hydraulic-model";
import { shortestPath } from "src/hydraulic-model/path-finding";
import { findClosestEndpointNode } from "src/hydraulic-model/spatial-queries";
import { getMapCoord, useClickedAsset } from "src/map/mode-handlers/utils";

export function useProfileViewHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { hydraulicModel, map } = handlerContext;
  const { getClickedAsset } = useClickedAsset(map, hydraulicModel.assets);

  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const plot = useAtomValue(profileViewAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setCursor = useSetAtom(cursorStyleAtom);

  const draftStartNodeId =
    ephemeralState.type === "profileView"
      ? ephemeralState.startNodeId
      : undefined;

  const draftPathCacheRef = useRef<{
    startNodeId: AssetId;
    hoveredNodeId: AssetId;
    path: DraftPath | undefined;
  } | null>(null);

  const resolveNodeId = (
    asset: Asset | null,
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): AssetId | undefined => {
    if (!asset) return undefined;
    if (asset.isNode) return asset.id;
    if (asset.isLink)
      return findClosestEndpointNode(asset as LinkAsset, getMapCoord(e));
    return undefined;
  };

  const click: Handlers["click"] = (e) => {
    const clickedAsset = getClickedAsset(e);
    const nodeId = resolveNodeId(clickedAsset, e);
    if (nodeId === undefined) return;

    if (plot !== null) {
      setProfileView(null);
      setEphemeralState({ type: "profileView", startNodeId: nodeId });
      return;
    }

    if (draftStartNodeId === undefined) {
      setEphemeralState({ type: "profileView", startNodeId: nodeId });
      return;
    }

    if (nodeId === draftStartNodeId) return;

    const path = shortestPath(
      hydraulicModel.topology,
      hydraulicModel.assets,
      draftStartNodeId,
      nodeId,
    );

    if (path === null) {
      setDialogState({ type: "profileNoPath" });
      setEphemeralState({ type: "none" });
      setSelection(SELECTION_NONE);
      return;
    }

    setProfileView({
      startNodeId: draftStartNodeId,
      endNodeId: nodeId,
      path,
    });
    setEphemeralState({ type: "none" });
    setSelection({
      type: "multi",
      ids: [...path.nodeIds, ...path.linkIds],
    });
  };

  const move: Handlers["move"] = throttle((e) => {
    const hoveredAsset = getClickedAsset(e);
    const hoveredNodeId = resolveNodeId(hoveredAsset, e);

    let path: DraftPath | undefined;
    if (
      draftStartNodeId !== undefined &&
      hoveredNodeId !== undefined &&
      hoveredNodeId !== draftStartNodeId
    ) {
      const cached = draftPathCacheRef.current;
      if (
        cached &&
        cached.startNodeId === draftStartNodeId &&
        cached.hoveredNodeId === hoveredNodeId
      ) {
        path = cached.path;
      } else {
        const found = shortestPath(
          hydraulicModel.topology,
          hydraulicModel.assets,
          draftStartNodeId,
          hoveredNodeId,
        );
        path = found
          ? { nodeIds: found.nodeIds, linkIds: found.linkIds }
          : undefined;
        draftPathCacheRef.current = {
          startNodeId: draftStartNodeId,
          hoveredNodeId,
          path,
        };
      }
    }

    setEphemeralState({
      type: "profileView",
      startNodeId: draftStartNodeId,
      hoveredNodeId,
      path,
    });
    setCursor(hoveredNodeId !== undefined ? "pointer" : "");
  }, 16);

  return {
    click,
    move,
    down: () => {},
    up: () => {},
    double: () => {},
    keydown: () => {},
    keyup: () => {},
    exit: () => {
      setProfileView(null);
      setEphemeralState({ type: "none" });
      setSelection(SELECTION_NONE);
      setCursor("");
    },
  };
}
