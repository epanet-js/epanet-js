import { modeAtom, Mode, MODE_INFO } from "src/state/jotai";
import MenuAction from "src/components/menu-action";
import { memo } from "react";
import { useAtomValue } from "jotai";
import { IWrappedFeature } from "src/types";
import { useUserTracking } from "src/infra/user-tracking";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { useTranslate } from "src/hooks/use-translate";
import { SelectionTool } from "./toolbar/selection-tool-dropdown";

import {
  JunctionIcon,
  ReservoirIcon,
  TankIcon,
  MouseCursorDefaultIcon,
  PumpIcon,
  ValveIcon,
  PipeIcon,
} from "src/icons";

const MODE_OPTIONS = [
  {
    mode: Mode.DRAW_JUNCTION,
    hotkey: "2",
    Icon: () => <JunctionIcon />,
  },
  {
    mode: Mode.DRAW_RESERVOIR,
    hotkey: "3",
    Icon: () => <ReservoirIcon />,
  },
  {
    mode: Mode.DRAW_TANK,
    hotkey: "4",
    Icon: () => <TankIcon />,
  },
  {
    mode: Mode.DRAW_PIPE,
    hotkey: "5",
    Icon: () => <PipeIcon />,
  },
  {
    mode: Mode.DRAW_PUMP,
    hotkey: "6",
    Icon: () => <PumpIcon />,
  },
  {
    mode: Mode.DRAW_VALVE,
    hotkey: "7",
    Icon: () => <ValveIcon />,
  },
] as const;

export default memo(function Modes({
  replaceGeometryForId,
}: {
  replaceGeometryForId: IWrappedFeature["id"] | null;
}) {
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setDrawingMode = useDrawingMode();
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const drawingModes = MODE_OPTIONS;

  return (
    <div className="flex items-center justify-start" role="radiogroup">
      {!replaceGeometryForId && (
        <MenuAction
          role="radio"
          key={Mode.NONE}
          selected={currentMode === Mode.NONE}
          readOnlyHotkey={"1"}
          label={translate(MODE_INFO[Mode.NONE].name)}
          onClick={() => {
            userTracking.capture({
              name: "drawingMode.enabled",
              source: "toolbar",
              type: MODE_INFO[Mode.NONE].name,
            });
            void setDrawingMode(Mode.NONE);
          }}
        >
          <MouseCursorDefaultIcon />
        </MenuAction>
      )}
      <SelectionTool />
      {drawingModes.map(({ mode, hotkey, Icon }) => {
        const modeInfo = MODE_INFO[mode];

        return (
          <MenuAction
            role="radio"
            key={mode}
            selected={currentMode === mode}
            readOnlyHotkey={hotkey}
            label={translate(modeInfo.name)}
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
