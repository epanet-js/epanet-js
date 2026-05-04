import throttle from "lodash/throttle";
import { useAtomValue, useSetAtom } from "jotai";
import { HandlerContext } from "src/types";
import { profileViewAtom } from "src/state/profile-view";
import { dialogAtom } from "src/state/dialog";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import { cursorStyleAtom } from "src/state/map";
import { selectionAtom } from "src/state/selection";
import { SELECTION_NONE } from "src/selection/selection";
import { shortestPath } from "src/hydraulic-model/path-finding";
import { useClickedAsset } from "src/map/mode-handlers/utils";

export function useProfileViewHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { hydraulicModel, map } = handlerContext;
  const { getClickedAsset } = useClickedAsset(map, hydraulicModel.assets);

  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setCursor = useSetAtom(cursorStyleAtom);

  const draftStartNodeId =
    ephemeralState.type === "profileView"
      ? ephemeralState.startNodeId
      : undefined;

  const click: Handlers["click"] = (e) => {
    const clickedAsset = getClickedAsset(e);
    if (!clickedAsset || !clickedAsset.isNode) return;
    const nodeId = clickedAsset.id;

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
      setMode({ mode: Mode.NONE });
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
    setMode({ mode: Mode.NONE });
  };

  const move: Handlers["move"] = throttle((e) => {
    const hoveredAsset = getClickedAsset(e);
    const hoveredNodeId =
      hoveredAsset && hoveredAsset.isNode ? hoveredAsset.id : undefined;

    setEphemeralState({
      type: "profileView",
      startNodeId: draftStartNodeId,
      hoveredNodeId,
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
