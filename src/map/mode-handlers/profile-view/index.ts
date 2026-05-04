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

  const profileView = useAtomValue(profileViewAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setCursor = useSetAtom(cursorStyleAtom);

  const click: Handlers["click"] = (e) => {
    const clickedAsset = getClickedAsset(e);
    if (!clickedAsset || !clickedAsset.isNode) return;
    const nodeId = clickedAsset.id;

    if (profileView.phase === "selectingStart") {
      setProfileView({ phase: "selectingEnd", startNodeId: nodeId });
      setEphemeralState({ type: "profileView", startNodeId: nodeId });
      return;
    }

    if (profileView.phase === "selectingEnd") {
      const startNodeId = profileView.startNodeId;
      if (nodeId === startNodeId) return;

      const path = shortestPath(
        hydraulicModel.topology,
        hydraulicModel.assets,
        startNodeId,
        nodeId,
      );

      if (path === null) {
        setDialogState({ type: "profileNoPath" });
        setProfileView({ phase: "idle" });
        setEphemeralState({ type: "none" });
        setSelection(SELECTION_NONE);
        setMode({ mode: Mode.NONE });
        return;
      }

      setProfileView({
        phase: "showingProfile",
        path,
        startNodeId,
        endNodeId: nodeId,
      });
      setEphemeralState({ type: "none" });
      setSelection({
        type: "multi",
        ids: [...path.nodeIds, ...path.linkIds],
      });
      setMode({ mode: Mode.NONE });
      return;
    }
  };

  const move: Handlers["move"] = throttle((e) => {
    if (
      profileView.phase !== "selectingStart" &&
      profileView.phase !== "selectingEnd"
    ) {
      setCursor("");
      return;
    }

    const hoveredAsset = getClickedAsset(e);
    const hoveredNodeId =
      hoveredAsset && hoveredAsset.isNode ? hoveredAsset.id : undefined;

    const startNodeId =
      profileView.phase === "selectingEnd"
        ? profileView.startNodeId
        : undefined;

    setEphemeralState({ type: "profileView", startNodeId, hoveredNodeId });
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
      setProfileView({ phase: "idle" });
      setEphemeralState({ type: "none" });
      setSelection(SELECTION_NONE);
      setCursor("");
    },
  };
}
