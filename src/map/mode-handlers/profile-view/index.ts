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
import { deriveProfilePath } from "src/panels/profile-view/path-finding";
import { buildProfileView } from "src/panels/profile-view/build-profile-view";
import { findClosestEndpointNode } from "src/hydraulic-model/spatial-queries";
import { isUnprojectedAtom } from "src/state/map-projection";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import { getMapCoord, useClickedAsset } from "src/map/mode-handlers/utils";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";

export function useProfileViewHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { hydraulicModel, map } = handlerContext;
  const { getClickedAsset } = useClickedAsset(map, hydraulicModel.assets);

  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const isUnprojected = useAtomValue(isUnprojectedAtom);
  const results = useAtomValue(simulationResultsDerivedAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const setMode = useSetAtom(modeAtom);
  const { isShiftHeld } = useKeyboardState();

  const draftAnchorIds: AssetId[] =
    (ephemeralState.type === "profileView" && ephemeralState.anchorIds) || [];

  const draftPathCacheRef = useRef<{
    anchorsKey: string;
    assetsVersion: unknown;
    resultsVersion: unknown;
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

    if (draftAnchorIds.length === 0) {
      setEphemeralState({ type: "profileView", anchorIds: [nodeId] });
      return;
    }

    if (isShiftHeld()) {
      const existingIndex = draftAnchorIds.indexOf(nodeId);
      if (existingIndex !== -1) {
        if (existingIndex === 0) return;
        const nextAnchors = draftAnchorIds.filter((id) => id !== nodeId);
        setEphemeralState({ type: "profileView", anchorIds: nextAnchors });
        return;
      }
      const candidate = [...draftAnchorIds, nodeId];
      const check = deriveProfilePath(
        hydraulicModel.topology,
        hydraulicModel.assets,
        candidate,
        results,
      );
      if (check === null) return;
      setEphemeralState({ type: "profileView", anchorIds: candidate });
      return;
    }

    if (nodeId === draftAnchorIds[draftAnchorIds.length - 1]) return;

    const allAnchors = [...draftAnchorIds, nodeId];
    const built = buildProfileView({
      anchorIds: allAnchors,
      hydraulicModel,
      isUnprojected,
      results,
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

    const extendable =
      hoveredNodeId !== undefined && !draftAnchorIds.includes(hoveredNodeId);

    const previewAnchors = extendable
      ? [...draftAnchorIds, hoveredNodeId]
      : draftAnchorIds;

    let path: DraftPath | undefined;
    if (previewAnchors.length >= 2) {
      const anchorsKey = previewAnchors.join(",");
      const cached = draftPathCacheRef.current;
      if (
        cached &&
        cached.anchorsKey === anchorsKey &&
        cached.assetsVersion === hydraulicModel.assets &&
        cached.resultsVersion === results
      ) {
        path = cached.path;
      } else {
        const found = deriveProfilePath(
          hydraulicModel.topology,
          hydraulicModel.assets,
          previewAnchors,
          results,
        );
        path = found
          ? { nodeIds: found.nodeIds, linkIds: found.linkIds }
          : undefined;
        draftPathCacheRef.current = {
          anchorsKey,
          assetsVersion: hydraulicModel.assets,
          resultsVersion: results,
          path,
        };
      }
    }

    setEphemeralState({
      type: "profileView",
      anchorIds: draftAnchorIds,
      hoveredNodeId,
      path,
    });

    const isExtendForbidden =
      extendable && draftAnchorIds.length >= 1 && path === undefined;
    setCursor(
      hoveredNodeId === undefined
        ? ""
        : isExtendForbidden
          ? "not-allowed"
          : "pointer",
    );
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
        (ephemeralState.anchorIds?.length ?? 0) > 0;

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
