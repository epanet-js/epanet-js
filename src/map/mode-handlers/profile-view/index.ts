import throttle from "lodash/throttle";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { HandlerContext } from "src/types";
import {
  profileViewAtom,
  profileHoverAtom,
  profileModifierAtom,
  PathData,
} from "src/state/profile-view";
import { dialogAtom } from "src/state/dialog";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import { cursorStyleAtom } from "src/state/map";
import { findPaths } from "src/hydraulic-model/path-finding";
import { useClickedAsset } from "src/map/mode-handlers/utils";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";
import { Asset, AssetId, AssetsMap } from "src/hydraulic-model";

function distanceSq(a: number[], b: { lng: number; lat: number }): number {
  const dx = a[0] - b.lng;
  const dy = a[1] - b.lat;
  return dx * dx + dy * dy;
}

function resolveToNodeId(
  clickedAsset: Asset,
  lngLat: { lng: number; lat: number },
  hydraulicModel: HandlerContext["hydraulicModel"],
): number | null {
  if (clickedAsset.isNode) return clickedAsset.id;

  const [startId, endId] = (clickedAsset as { connections: [number, number] })
    .connections;
  const startNode = hydraulicModel.assets.get(startId);
  const endNode = hydraulicModel.assets.get(endId);
  if (!startNode || !endNode) return startId;

  const startCoords = (startNode as { coordinates: number[] }).coordinates;
  const endCoords = (endNode as { coordinates: number[] }).coordinates;

  return distanceSq(startCoords, lngLat) <= distanceSq(endCoords, lngLat)
    ? startId
    : endId;
}

function concatenatePaths(first: PathData, second: PathData): PathData {
  return {
    nodeIds: [...first.nodeIds, ...second.nodeIds.slice(1)],
    linkIds: [...first.linkIds, ...second.linkIds],
    totalLength: first.totalLength + second.totalLength,
  };
}

function buildSlicedPathData(
  nodeIds: AssetId[],
  linkIds: AssetId[],
  assets: AssetsMap,
): PathData {
  let totalLength = 0;
  for (const linkId of linkIds) {
    const link = assets.get(linkId);
    if (link?.isLink) totalLength += (link as { length: number }).length;
  }
  return { nodeIds, linkIds, totalLength };
}

/**
 * Returns the new PathData after removing the given asset from the path,
 * or null if the asset is not part of the path.
 * For a middle node: removes the node and its two adjacent links, keeps the larger segment.
 * For a link: removes it and keeps the larger segment.
 */
export function subtractFromPath(
  path: PathData,
  assetId: AssetId,
  isLink: boolean,
  assets: AssetsMap,
): PathData | null {
  const { nodeIds, linkIds } = path;

  if (!isLink) {
    const nodeIndex = nodeIds.indexOf(assetId);
    if (nodeIndex === -1) return null;

    if (nodeIndex === 0) {
      if (nodeIds.length <= 1) return null;
      return buildSlicedPathData(nodeIds.slice(1), linkIds.slice(1), assets);
    }

    if (nodeIndex === nodeIds.length - 1) {
      return buildSlicedPathData(
        nodeIds.slice(0, -1),
        linkIds.slice(0, -1),
        assets,
      );
    }

    const segA = buildSlicedPathData(
      nodeIds.slice(0, nodeIndex),
      linkIds.slice(0, nodeIndex - 1),
      assets,
    );
    const segB = buildSlicedPathData(
      nodeIds.slice(nodeIndex + 1),
      linkIds.slice(nodeIndex + 1),
      assets,
    );
    return segA.totalLength >= segB.totalLength ? segA : segB;
  } else {
    const linkIndex = linkIds.indexOf(assetId);
    if (linkIndex === -1) return null;

    const segA = buildSlicedPathData(
      nodeIds.slice(0, linkIndex + 1),
      linkIds.slice(0, linkIndex),
      assets,
    );
    const segB = buildSlicedPathData(
      nodeIds.slice(linkIndex + 1),
      linkIds.slice(linkIndex + 1),
      assets,
    );
    return segA.totalLength >= segB.totalLength ? segA : segB;
  }
}

/**
 * Finds the shorter extension from nodeId to either the start or end of the current path.
 * Returns the merged PathData and whether the new node is the new start (true) or end (false).
 */
function computeNearestExtension(
  hydraulicModel: HandlerContext["hydraulicModel"],
  nodeId: AssetId,
  currentPath: PathData,
  startNodeId: AssetId,
  endNodeId: AssetId,
): { path: PathData; isNewStart: boolean } | null {
  const pathsToStart = findPaths(
    hydraulicModel.topology,
    hydraulicModel.assets,
    nodeId,
    startNodeId,
  );
  const pathsToEnd = findPaths(
    hydraulicModel.topology,
    hydraulicModel.assets,
    endNodeId,
    nodeId,
  );

  const bestToStart = pathsToStart[0];
  const bestToEnd = pathsToEnd[0];

  if (!bestToStart && !bestToEnd) return null;

  if (!bestToStart) {
    return {
      path: concatenatePaths(currentPath, bestToEnd),
      isNewStart: false,
    };
  }

  if (!bestToEnd) {
    const extended: PathData = {
      nodeIds: [...bestToStart.nodeIds, ...currentPath.nodeIds.slice(1)],
      linkIds: [...bestToStart.linkIds, ...currentPath.linkIds],
      totalLength: bestToStart.totalLength + currentPath.totalLength,
    };
    return { path: extended, isNewStart: true };
  }

  if (bestToStart.totalLength <= bestToEnd.totalLength) {
    const extended: PathData = {
      nodeIds: [...bestToStart.nodeIds, ...currentPath.nodeIds.slice(1)],
      linkIds: [...bestToStart.linkIds, ...currentPath.linkIds],
      totalLength: bestToStart.totalLength + currentPath.totalLength,
    };
    return { path: extended, isNewStart: true };
  }

  return { path: concatenatePaths(currentPath, bestToEnd), isNewStart: false };
}

export function useProfileViewHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { hydraulicModel, map } = handlerContext;
  const { getClickedAsset } = useClickedAsset(map, hydraulicModel.assets);

  const profileView = useAtomValue(profileViewAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setProfileHover = useSetAtom(profileHoverAtom);
  const setProfileModifier = useSetAtom(profileModifierAtom);
  const profileHoverRef = useRef<number | null>(null);
  const setDialogState = useSetAtom(dialogAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);

  const { isShiftHeld, isAltHeld } = useKeyboardState();

  const identifyModifier = (): "extend" | "subtract" | "none" => {
    if (isShiftHeld()) return "extend";
    if (isAltHeld()) return "subtract";
    return "none";
  };

  const getPointerCursor = (hasHoveredAsset: boolean) => {
    if (!hasHoveredAsset) return "";
    const modifier = identifyModifier();
    if (modifier === "extend") return "pointer-add";
    if (modifier === "subtract") return "pointer-subtract";
    return "pointer";
  };

  const resetProfileView = () => {
    profileHoverRef.current = null;
    setProfileView({ phase: "idle" });
    setProfileHover(null);
    setProfileModifier("none");
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  const click: Handlers["click"] = (e) => {
    const clickedAsset = getClickedAsset(e);

    if (profileView.phase === "selectingStart") {
      if (!clickedAsset) return;
      const nodeId = resolveToNodeId(clickedAsset, e.lngLat, hydraulicModel);
      if (nodeId === null) return;
      setProfileView({ phase: "selectingEnd", startNodeId: nodeId });
      return;
    }

    if (profileView.phase === "selectingEnd") {
      if (!clickedAsset) return;
      const nodeId = resolveToNodeId(clickedAsset, e.lngLat, hydraulicModel);
      if (nodeId === null) return;

      const startNodeId = profileView.startNodeId;
      if (nodeId === startNodeId) return;

      const paths = findPaths(
        hydraulicModel.topology,
        hydraulicModel.assets,
        startNodeId,
        nodeId,
      );

      if (paths.length === 0) {
        setDialogState({ type: "profileNoPath" });
        resetProfileView();
        return;
      }

      setProfileHover(null);
      setProfileView({
        phase: "showingProfile",
        path: paths[0],
        startNodeId,
        endNodeId: nodeId,
      });
      setEphemeralState({ type: "profileView" });
      return;
    }

    if (profileView.phase === "showingProfile") {
      if (!clickedAsset) return;

      const modifier = identifyModifier();

      if (modifier === "extend") {
        const nodeId = resolveToNodeId(clickedAsset, e.lngLat, hydraulicModel);
        if (nodeId === null) return;
        if (
          nodeId === profileView.startNodeId ||
          nodeId === profileView.endNodeId
        )
          return;

        const result = computeNearestExtension(
          hydraulicModel,
          nodeId,
          profileView.path,
          profileView.startNodeId,
          profileView.endNodeId,
        );

        if (!result) {
          setDialogState({ type: "profileNoPath" });
          return;
        }

        setProfileView({
          phase: "showingProfile",
          path: result.path,
          startNodeId: result.isNewStart ? nodeId : profileView.startNodeId,
          endNodeId: result.isNewStart ? profileView.endNodeId : nodeId,
        });
      } else if (modifier === "subtract") {
        const assetId = clickedAsset.id;
        const isLink = !clickedAsset.isNode;

        const result = subtractFromPath(
          profileView.path,
          assetId,
          isLink,
          hydraulicModel.assets,
        );
        if (result === null) return;

        if (result.nodeIds.length < 2) {
          // Path collapsed to a single node — restart selection
          setProfileView({
            phase: "selectingEnd",
            startNodeId: result.nodeIds[0],
          });
          return;
        }

        setProfileView({
          phase: "showingProfile",
          path: result,
          startNodeId: result.nodeIds[0],
          endNodeId: result.nodeIds[result.nodeIds.length - 1],
        });
      } else {
        // Normal click: start fresh selection from this node
        const nodeId = resolveToNodeId(clickedAsset, e.lngLat, hydraulicModel);
        if (nodeId === null) return;
        setProfileView({ phase: "selectingEnd", startNodeId: nodeId });
      }
    }
  };

  const move: Handlers["move"] = throttle((e) => {
    if (
      profileView.phase !== "selectingStart" &&
      profileView.phase !== "selectingEnd" &&
      profileView.phase !== "showingProfile"
    ) {
      setProfileHover(null);
      setCursor("");
      return;
    }

    const hoveredAsset = getClickedAsset(e);
    if (!hoveredAsset) {
      profileHoverRef.current = null;
      setProfileHover(null);
      setCursor("");
      return;
    }

    const isAlt = isAltHeld();

    if (isAlt && profileView.phase === "showingProfile") {
      // In subtract mode keep the raw asset (node or link)
      profileHoverRef.current = hoveredAsset.id;
      setProfileHover({ id: hoveredAsset.id, isLink: !hoveredAsset.isNode });
    } else {
      const nodeId = resolveToNodeId(hoveredAsset, e.lngLat, hydraulicModel);
      profileHoverRef.current = nodeId;
      setProfileHover(nodeId !== null ? { id: nodeId, isLink: false } : null);
    }

    if (profileView.phase === "showingProfile") {
      setCursor(getPointerCursor(true));
      setProfileModifier(identifyModifier());
    }
  }, 16);

  const updateCursorAndModifier = () => {
    if (profileView.phase !== "showingProfile") return;
    const isHovering = profileHoverRef.current !== null;
    setCursor(getPointerCursor(isHovering));
    setProfileModifier(identifyModifier());
  };

  return {
    click,
    move,
    down: () => {},
    up: () => {},
    double: () => {},
    keydown: updateCursorAndModifier,
    keyup: updateCursorAndModifier,
    exit: () => {
      profileHoverRef.current = null;
      setProfileHover(null);
      setProfileModifier("none");
      setCursor("");
      if (profileView.phase === "showingProfile") {
        setMode({ mode: Mode.NONE });
      } else {
        setProfileView({ phase: "idle" });
        setEphemeralState({ type: "none" });
        setMode({ mode: Mode.NONE });
      }
    },
  };
}
