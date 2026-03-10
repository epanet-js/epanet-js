import { modeAtom, Mode, MODE_INFO } from "src/state/mode";
import MenuAction from "src/components/menu-action";
import { memo } from "react";
import { useAtomValue } from "jotai";
import { useUserTracking } from "src/infra/user-tracking";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { useTranslate } from "src/hooks/use-translate";
import { SelectionTool } from "./toolbar/selection-tool";
import { TraceTool } from "./toolbar/trace-tool";

import {
  JunctionIcon,
  ReservoirIcon,
  TankIcon,
  MouseCursorDefaultIcon,
  PumpIcon,
  ValveIcon,
  PipeIcon,
  CustomerPointIcon,
} from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

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

const CUSTOMER_POINT_MODE = {
  mode: Mode.DRAW_CUSTOMER_POINT,
  hotkey: "8",
  Icon: () => <CustomerPointIcon />,
} as const;

export default memo(function Modes({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setDrawingMode = useDrawingMode();
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const isCreateCustomerOn = useFeatureFlag("FLAG_CREATE_CUSTOMER");
  const drawingModes = isCreateCustomerOn
    ? [...MODE_OPTIONS, CUSTOMER_POINT_MODE]
    : MODE_OPTIONS;

  return (
    <div className="flex items-center justify-start" role="radiogroup">
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
      <SelectionTool />
      <TraceTool />
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
            disabled={disabled}
          >
            <Icon />
          </MenuAction>
        );
      })}
    </div>
  );
});
