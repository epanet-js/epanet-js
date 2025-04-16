import {
  CursorArrowIcon,
  CircleIcon,
  StretchHorizontallyIcon,
  VercelLogoIcon,
} from "@radix-ui/react-icons";
import { modeAtom, Mode, MODE_INFO } from "src/state/jotai";
import MenuAction from "src/components/menu_action";
import { memo } from "react";
import { useAtomValue } from "jotai";
import { IWrappedFeature } from "src/types";
import { useUserTracking } from "src/infra/user-tracking";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { isFeatureOn } from "src/infra/feature-flags";
import { PumpIcon } from "src/map/icons/pump-icon";

const MODE_OPTIONS = isFeatureOn("FLAG_PUMP")
  ? ([
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
      {
        mode: Mode.DRAW_PUMP,
        hotkey: "5",
        alwaysMultiple: true,
        Icon: () => <PumpIcon width={15} height={15} className="rotate-90" />,
        Menu: null,
      },
    ] as const)
  : ([
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
    ] as const);

export default memo(function Modes({
  replaceGeometryForId,
}: {
  replaceGeometryForId: IWrappedFeature["id"] | null;
}) {
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setDrawingMode = useDrawingMode();
  const userTracking = useUserTracking();

  return (
    <div className="flex items-center justify-start" role="radiogroup">
      {MODE_OPTIONS.filter((mode) => {
        if (!replaceGeometryForId) return true;
        return mode.mode !== Mode.NONE;
      }).map(({ mode, hotkey, Icon }, i) => {
        const modeInfo = MODE_INFO[mode];
        return (
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
        );
      })}
    </div>
  );
});
