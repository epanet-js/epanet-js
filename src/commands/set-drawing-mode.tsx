import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { ephemeralStateAtom, selectionAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { USelection } from "src/selection/selection";

export const drawingModeShorcuts: { [key in Mode]: string } = {
  [Mode.NONE]: "1",
  [Mode.DRAW_JUNCTION]: "2",
  [Mode.DRAW_RESERVOIR]: "3",
  [Mode.DRAW_TANK]: "4",
  [Mode.DRAW_PIPE]: "5",
  [Mode.DRAW_PUMP]: "6",
  [Mode.DRAW_VALVE]: "7",
};

export const useDrawingMode = () => {
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setSelection = useSetAtom(selectionAtom);
  const currentMode = useAtomValue(modeAtom);
  const isClearSelectOn = useFeatureFlag("FLAG_CLEAR_SELECT");

  const setDrawingMode = useCallback(
    (mode: Mode) => {
      setEphemeralState({ type: "none" });

      if (isClearSelectOn && currentMode.mode !== mode) {
        setSelection(USelection.none());
      }

      setMode({
        mode,
        modeOptions: { multi: true },
      });
    },
    [
      setMode,
      setEphemeralState,
      setSelection,
      currentMode.mode,
      isClearSelectOn,
    ],
  );

  return setDrawingMode;
};
