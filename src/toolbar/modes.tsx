import { modeAtom, Mode, MODE_INFO } from "src/state/mode";
import MenuAction from "src/components/menu-action";
import { memo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useUserTracking } from "src/infra/user-tracking";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { useTranslate } from "src/hooks/use-translate";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { SelectionTool } from "./selection-tool";
import { TraceTool } from "./trace-tool";
import { DrawingToolDropdown } from "./drawing-tool-dropdown";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";

import {
  JunctionIcon,
  ReservoirIcon,
  TankIcon,
  MouseCursorDefaultIcon,
  PumpIcon,
  ValveIcon,
  PipeIcon,
  CustomerPointIcon,
  ProfileViewIcon,
} from "src/icons";

export type DrawingModeOption = {
  mode: Mode;
  hotkey: string;
  Icon: () => JSX.Element;
};

export const DRAWING_MODE_OPTIONS: readonly DrawingModeOption[] = [
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
  {
    mode: Mode.DRAW_CUSTOMER_POINT,
    hotkey: "8",
    Icon: () => <CustomerPointIcon />,
  },
] as const;

export default memo(function Modes({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setDrawingMode = useDrawingMode();
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const isMdOrLarger = useBreakpoint("md");
  const isLgOrLarger = useBreakpoint("lg");
  const isProfileViewOn = useFeatureFlag("FLAG_PROFILE_VIEW");

  const handleProfileViewClick = () => {
    if (currentMode === Mode.PROFILE_VIEW) {
      // Toggle off
      setProfileView({ phase: "idle" });
      setEphemeralState({ type: "none" });
      void setDrawingMode(Mode.NONE);
    } else {
      setProfileView({ phase: "selectingStart" });
      setEphemeralState({ type: "profileView" });
      setMode({ mode: Mode.PROFILE_VIEW });
    }
  };

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
      {isProfileViewOn && (
        <MenuAction
          role="radio"
          selected={currentMode === Mode.PROFILE_VIEW}
          readOnlyHotkey={"9"}
          label={translate("profileView.toolbar")}
          onClick={handleProfileViewClick}
          disabled={false}
        >
          <ProfileViewIcon />
        </MenuAction>
      )}
      {!isMdOrLarger ? null : isLgOrLarger ? (
        DRAWING_MODE_OPTIONS.map(({ mode, hotkey, Icon }) => {
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
        })
      ) : (
        <DrawingToolDropdown disabled={disabled} />
      )}
    </div>
  );
});
