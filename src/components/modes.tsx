import {
  CursorArrowIcon,
  PlusIcon,
  CircleIcon,
  StretchHorizontallyIcon,
  VercelLogoIcon,
} from "@radix-ui/react-icons";
import {
  modeAtom,
  Mode,
  MODE_INFO,
  ephemeralStateAtom,
  circleTypeAtom,
} from "src/state/jotai";
import MenuAction from "src/components/menu_action";
import { memo } from "react";
import { useSetAtom, useAtom, useAtomValue } from "jotai";
import { IWrappedFeature } from "src/types";
import { useUserTracking } from "src/infra/user-tracking";
import { isFeatureOn } from "src/infra/feature-flags";
import { useDrawingMode } from "src/commands/set-drawing-mode";

const MODE_OPTIONS = [
  {
    mode: Mode.NONE,
    hotkey: "1",
    Icon: CursorArrowIcon,
    alwaysMultiple: false,
    Menu: null,
  },
  {
    mode: Mode.DRAW_JUNCTION,
    hotkey: "2",
    alwaysMultiple: true,
    Icon: CircleIcon,
    Menu: null,
  },
  {
    mode: Mode.DRAW_PIPE,
    hotkey: "3",
    alwaysMultiple: true,
    Icon: StretchHorizontallyIcon,
    Menu: null,
  },

  {
    mode: Mode.DRAW_RESERVOIR,
    hotkey: "4",
    alwaysMultiple: true,
    Icon: VercelLogoIcon,
    Menu: null,
  },
] as const;

export default memo(function Modes({
  replaceGeometryForId,
}: {
  replaceGeometryForId: IWrappedFeature["id"] | null;
}) {
  const [{ mode: currentMode, modeOptions }, setMode] = useAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const circleType = useAtomValue(circleTypeAtom);
  const setDrawingMode = useDrawingMode();
  const userTracking = useUserTracking();

  return (
    <div className="flex items-center justify-start" role="radiogroup">
      {MODE_OPTIONS.filter((mode) => {
        if (!replaceGeometryForId) return true;
        return mode.mode !== Mode.NONE;
      }).map(({ mode, hotkey, alwaysMultiple, Icon }, i) => {
        const modeInfo = MODE_INFO[mode];
        const menuAction = isFeatureOn("FLAG_TRACKING") ? (
          <MenuAction
            role="radio"
            key={i}
            selected={currentMode === mode}
            readOnlyHotkey={hotkey}
            label={modeInfo.label}
            onClick={() => {
              userTracking.capture({
                name: "drawingMode.enabled",
                source: "toolbar",
                type: modeInfo.name,
              });
              void setDrawingMode(mode);
            }}
          >
            <Icon />
          </MenuAction>
        ) : (
          <MenuAction
            role="radio"
            key={i}
            selected={currentMode === mode}
            hotkey={hotkey}
            label={MODE_INFO[mode].label}
            onClick={(e) => {
              setEphemeralState({ type: "none" });
              setMode({
                mode,
                modeOptions: {
                  multi: alwaysMultiple || !!e?.shiftKey,
                  replaceGeometryForId,
                  circleType,
                },
              });
            }}
          >
            <Icon />
            {currentMode === mode && modeOptions?.multi ? (
              <PlusIcon className="w-2 h-2 absolute bottom-1 right-1" />
            ) : null}
          </MenuAction>
        );
        return menuAction;
      })}
    </div>
  );
});
