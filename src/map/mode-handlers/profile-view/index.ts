import { useRef } from "react";
import throttle from "lodash/throttle";
import { useAtomValue, useSetAtom } from "jotai";
import { HandlerContext } from "src/types";
import { profileViewAtom } from "src/state/profile-view";
import { dialogAtom } from "src/state/dialog";
import { DraftPath, ephemeralStateAtom } from "src/state/drawing";
import { cursorStyleAtom } from "src/state/map";
import { Mode, modeAtom } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { SELECTION_NONE } from "src/selection/selection";
import { Asset, AssetId, LinkAsset } from "src/hydraulic-model";
import { findProfilePath } from "src/panels/profile-view/path-finding";
import { buildProfileView } from "src/panels/profile-view/build-profile-view";
import { findClosestEndpointNode } from "src/hydraulic-model/spatial-queries";
import { isUnprojectedAtom } from "src/state/map-projection";
import { getMapCoord, useClickedAsset } from "src/map/mode-handlers/utils";

export function useProfileViewHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { hydraulicModel, map } = handlerContext;
  const { getClickedAsset } = useClickedAsset(map, hydraulicModel.assets);

  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const isUnprojected = useAtomValue(isUnprojectedAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const setMode = useSetAtom(modeAtom);

  const draftStartNodeId =
    ephemeralState.type === "profileView"
      ? ephemeralState.startNodeId
      : undefined;

  const draftPathCacheRef = useRef<{
    startNodeId: AssetId;
    hoveredNodeId: AssetId;
    assetsVersion: unknown;
    path: DraftPath | undefined;
  } | null>(null);

  const computePath = (start: AssetId, end: AssetId) =>
    findProfilePath(hydraulicModel.topology, hydraulicModel.assets, start, end);

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

    if (draftStartNodeId === undefined) {
      setEphemeralState({ type: "profileView", startNodeId: nodeId });
      return;
    }

    if (nodeId === draftStartNodeId) return;

    const built = buildProfileView({
      startNodeId: draftStartNodeId,
      endNodeId: nodeId,
      hydraulicModel,
      isUnprojected,
    });

    if ("error" in built) {
      setDialogState({ type: "profileNoPath" });
      setEphemeralState({ type: "none" });
      setSelection(SELECTION_NONE);
      return;
    }

    setProfileView(built.profileView);
    setEphemeralState({ type: "none" });
    setSelection({
      type: "multi",
      ids: [...built.path.nodeIds, ...built.path.linkIds],
    });
    setMode({ mode: Mode.NONE });
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
        cached.hoveredNodeId === hoveredNodeId &&
        cached.assetsVersion === hydraulicModel.assets
      ) {
        path = cached.path;
      } else {
        const found = computePath(draftStartNodeId, hoveredNodeId);
        path = found
          ? { nodeIds: found.nodeIds, linkIds: found.linkIds }
          : undefined;
        draftPathCacheRef.current = {
          startNodeId: draftStartNodeId,
          hoveredNodeId,
          assetsVersion: hydraulicModel.assets,
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
      const hasDraft =
        ephemeralState.type === "profileView" &&
        ephemeralState.startNodeId !== undefined;

      setProfileView(null);
      setSelection(SELECTION_NONE);
      setCursor("");

      if (hasDraft) {
        setEphemeralState({ type: "profileView" });
        return;
      }

      setEphemeralState({ type: "none" });
      setMode({ mode: Mode.NONE });
    },
  };
}
