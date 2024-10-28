import {
  CursorArrowIcon,
  PlusIcon,
  CircleIcon,
  StretchHorizontallyIcon,
} from "@radix-ui/react-icons";
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
import { USelection } from "src/selection";
import { IWrappedFeature } from "src/types";

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
] as const;

export default memo(function Modes({
  replaceGeometryForId,
}: {
  replaceGeometryForId: IWrappedFeature["id"] | null;
}) {
  const [{ mode: currentMode, modeOptions }, setMode] = useAtom(modeAtom);
  const setData = useSetAtom(dataAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const circleType = useAtomValue(circleTypeAtom);

  return (
    <div className="flex items-center justify-start gap-x-1" role="radiogroup">
      {MODE_OPTIONS.filter((mode) => {
        if (!replaceGeometryForId) return true;
        return mode.mode !== Mode.NONE;
      }).map(({ mode, hotkey, alwaysMultiple, Icon }, i) => {
        const menuAction = (
          <MenuAction
            role="radio"
            key={i}
            selected={currentMode === mode}
            hotkey={hotkey}
            label={MODE_INFO[mode].label}
            onClick={(e) => {
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
