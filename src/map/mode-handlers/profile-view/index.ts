import { useRef } from "react";
import throttle from "lodash/throttle";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { HandlerContext } from "src/types";
import { profileViewAtom } from "src/state/profile-view";
import { DraftPath, ephemeralStateAtom } from "src/state/drawing";
import { cursorStyleAtom } from "src/state/map";
import { Mode, modeAtom } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { Asset, AssetId, LinkAsset } from "src/hydraulic-model";
import { deriveProfilePath } from "src/panels/profile-view/path-finding";
import { buildProfileView } from "src/panels/profile-view/build-profile-view";
import { findClosestEndpointNode } from "src/hydraulic-model/spatial-queries";
import { isUnprojectedAtom } from "src/state/map-projection";
import { getMapCoord, useClickedAsset } from "src/map/mode-handlers/utils";
import {
  simulationDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { useUserTracking } from "src/infra/user-tracking";

export function useProfileViewHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { hydraulicModel, map } = handlerContext;
  const { getClickedAsset } = useClickedAsset(map, hydraulicModel.assets);

  const store = useStore();
  const isUnprojected = useAtomValue(isUnprojectedAtom);
  const results = useAtomValue(simulationResultsDerivedAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const setMode = useSetAtom(modeAtom);
  const userTracking = useUserTracking();

  const previewPathCacheRef = useRef<{
    anchorsKey: string;
    assetsVersion: unknown;
    resultsVersion: unknown;
    path: DraftPath | undefined;
  } | null>(null);

  const getCurrentAnchors = (): AssetId[] => {
    const profileView = store.get(profileViewAtom);
    if (profileView) return profileView.anchors;
    const ephemeral = store.get(ephemeralStateAtom);
    return (ephemeral.type === "profileView" && ephemeral.anchorIds) || [];
  };

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

  const exitMode = () => {
    if (store.get(profileViewAtom) === null) {
      userTracking.capture({
        name: "profileView.selectionCancelled",
        anchorCount: getCurrentAnchors().length,
      });
    }
    setCursor("");
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  const click: Handlers["click"] = (e) => {
    const clickedAsset = getClickedAsset(e);
    const nodeId = resolveNodeId(clickedAsset, e);
    if (nodeId === undefined) return;

    const anchors = getCurrentAnchors();
    if (nodeId === anchors[anchors.length - 1]) return;

    const candidate = [...anchors, nodeId];

    if (candidate.length < 2) {
      setEphemeralState({ type: "profileView", anchorIds: candidate });
      return;
    }

    const built = buildProfileView({
      anchorIds: candidate,
      hydraulicModel,
      isUnprojected,
      results,
    });
    if ("error" in built) return;

    const hadProfileView = store.get(profileViewAtom) !== null;
    const simulation = store.get(simulationDerivedAtom);
    userTracking.capture({
      name: hadProfileView
        ? "profileView.pathExtended"
        : "profileView.pathCreated",
      anchorCount: candidate.length,
      nodeCount: built.path.nodeIds.length,
      linkCount: built.path.linkIds.length,
      totalLength: built.path.totalLength,
      hasSimulationResults:
        "epsResultsReader" in simulation && !!simulation.epsResultsReader,
      simulationStatus: simulation.status,
    });

    setProfileView(built.profileView);
    setEphemeralState({ type: "profileView" });
    setSelection({
      type: "multi",
      ids: [...built.path.nodeIds, ...built.path.linkIds],
    });
  };

  const double: Handlers["double"] = (e) => {
    e.preventDefault();
    exitMode();
  };

  const move: Handlers["move"] = throttle((e) => {
    const hoveredAsset = getClickedAsset(e);
    const hoveredNodeId = resolveNodeId(hoveredAsset, e);

    const currentAnchors = getCurrentAnchors();
    const extendable =
      hoveredNodeId !== undefined && !currentAnchors.includes(hoveredNodeId);

    const previewAnchors = extendable
      ? [...currentAnchors, hoveredNodeId]
      : currentAnchors;

    let previewPath: DraftPath | undefined;
    if (previewAnchors.length >= 2) {
      const anchorsKey = previewAnchors.join(",");
      const cached = previewPathCacheRef.current;
      if (
        cached &&
        cached.anchorsKey === anchorsKey &&
        cached.assetsVersion === hydraulicModel.assets &&
        cached.resultsVersion === results
      ) {
        previewPath = cached.path;
      } else {
        const found = deriveProfilePath(
          hydraulicModel.topology,
          hydraulicModel.assets,
          previewAnchors,
          results,
        );
        previewPath = found
          ? { nodeIds: found.nodeIds, linkIds: found.linkIds }
          : undefined;
        previewPathCacheRef.current = {
          anchorsKey,
          assetsVersion: hydraulicModel.assets,
          resultsVersion: results,
          path: previewPath,
        };
      }
    }

    const ephemeral = store.get(ephemeralStateAtom);
    const stagedAnchorIds =
      ephemeral.type === "profileView" ? ephemeral.anchorIds : undefined;
    setEphemeralState({
      type: "profileView",
      anchorIds: stagedAnchorIds,
      hoveredNodeId,
      path: previewPath,
    });

    const isExtendForbidden =
      extendable && currentAnchors.length >= 1 && previewPath === undefined;
    setCursor(isExtendForbidden ? "not-allowed" : "");
  }, 16);

  return {
    click,
    move,
    down: () => {},
    up: () => {},
    double,
    keydown: () => {},
    keyup: () => {},
    exit: exitMode,
  };
}
