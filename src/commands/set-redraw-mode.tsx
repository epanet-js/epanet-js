import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { LinkAsset } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { USelection } from "src/selection";
import {
  dataAtom,
  selectionAtom,
  ephemeralStateAtom,
  modeAtom,
  Mode,
} from "src/state/jotai";

export const redrawModeShortcut = "e";

export const useSetRedrawMode = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const selection = useAtomValue(selectionAtom);
  const isRedrawOn = useFeatureFlag("FLAG_REDRAW");
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const userTracking = useUserTracking();

  const setRedrawMode = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      if (!isRedrawOn) return;

      const selectedIds = USelection.toIds(selection);

      if (selectedIds.length !== 1) return;

      const selectedAsset = hydraulicModel.assets.get(selectedIds[0]);

      if (!selectedAsset || !selectedAsset.isLink) return;

      const linkAsset = selectedAsset as LinkAsset;

      userTracking.capture({
        name: "asset.redrawStarted",
        source,
        type: linkAsset.type,
      });

      setEphemeralState({
        type: "drawLink",
        linkType: linkAsset.type,
        snappingCandidate: null,
        sourceLink: linkAsset,
      });

      setMode({ mode: Mode.REDRAW_LINK });
    },
    [
      isRedrawOn,
      selection,
      hydraulicModel,
      userTracking,
      setEphemeralState,
      setMode,
    ],
  );

  return setRedrawMode;
};
