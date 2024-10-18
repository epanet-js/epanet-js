import {
  CursorArrowIcon,
  DotFilledIcon,
  PlusIcon,
  CircleIcon,
  StretchHorizontallyIcon,
} from "@radix-ui/react-icons";
import Line from "src/components/icons/line";
import {
  modeAtom,
  Mode,
  MODE_INFO,
  ephemeralStateAtom,
  dataAtom,
  circleTypeAtom,
} from "src/state/jotai";
import MenuAction from "src/components/menu_action";
import { memo } from "react";
import { useSetAtom, useAtom, useAtomValue } from "jotai";
import { useLineMode } from "src/hooks/use_line_mode";
import { USelection } from "src/state";
import { IWrappedFeature } from "src/types";

const MODE_OPTIONS = [
  {
    mode: Mode.NONE,
    hotkey: "1",
    Icon: CursorArrowIcon,
    Menu: null,
  },
  {
    mode: Mode.DRAW_JUNCTION,
    hotkey: "2",
    Icon: CircleIcon,
    Menu: null,
  },
  {
    mode: Mode.DRAW_PIPE,
    hotkey: "3",
    Icon: StretchHorizontallyIcon,
    Menu: null,
  },
  {
    mode: Mode.DRAW_POINT,
    hotkey: "4",
    Icon: DotFilledIcon,
    Menu: null,
  },
  {
    mode: Mode.DRAW_LINE,
    hotkey: "5",
    Icon: Line,
    Menu: null,
  }
] as const;

export default memo(function Modes({
  replaceGeometryForId,
}: {
  replaceGeometryForId: IWrappedFeature["id"] | null;
}) {
  const [{ mode: currentMode, modeOptions }, setMode] = useAtom(modeAtom);
  const setData = useSetAtom(dataAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const lineMode = useLineMode();
  const circleType = useAtomValue(circleTypeAtom);

  return (
    <div className="flex items-center justify-start gap-x-1" role="radiogroup">
      {MODE_OPTIONS.filter((mode) => {
        if (!replaceGeometryForId) return true;
        return mode.mode !== Mode.NONE;
      }).map(({ mode, hotkey, Icon }, i) => {
        const menuAction = (
          <MenuAction
            role="radio"
            key={i}
            selected={currentMode === mode}
            hotkey={hotkey}
            label={MODE_INFO[mode].label}
            onClick={(e) => {
              if (mode === Mode.DRAW_LINE) {
                void lineMode({
                  event: e,
                  replaceGeometryForId,
                });
              } else {
                setEphemeralState({ type: "none" });
                setData((data) => {
                  return {
                    ...data,
                    selection: USelection.selectionToFolder(data),
                  };
                });
                setMode({
                  mode,
                  modeOptions: {
                    multi: !!e?.shiftKey,
                    replaceGeometryForId,
                    circleType,
                  },
                });
              }
            }}
          >
            <Icon />
            {currentMode === mode && modeOptions?.multi ? (
              <PlusIcon className="w-2 h-2 absolute bottom-1 right-1" />
            ) : null}
          </MenuAction>
        );
        return menuAction
      })}
    </div>
  );
});
