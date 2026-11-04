import {
  RectangularSelectionIcon,
  PolygonalSelectionIcon,
  FreeHandSelectionIcon,
} from "src/icons";
import { Mode, lastSelectionModeAtom } from "src/state/mode";
import { useTranslate } from "src/hooks/use-translate";
import {
  selectionModeShortcut,
  useCycleSelectionMode,
} from "src/commands/set-area-selection-mode";
import { ToolWithOptions } from "./tool-with-options";

export const SelectionTool = () => {
  const translate = useTranslate();
  const cycleSelectionMode = useCycleSelectionMode();

  return (
    <ToolWithOptions
      label={translate("areaSelection.tool")}
      shortcut={selectionModeShortcut}
      lastModeAtom={lastSelectionModeAtom}
      cycleMode={cycleSelectionMode}
      options={[
        {
          mode: Mode.SELECT_RECTANGULAR,
          label: translate("areaSelection.rectangular"),
          Icon: RectangularSelectionIcon,
        },
        {
          mode: Mode.SELECT_POLYGONAL,
          label: translate("areaSelection.polygonal"),
          Icon: PolygonalSelectionIcon,
        },
        {
          mode: Mode.SELECT_FREEHAND,
          label: translate("areaSelection.freehand"),
          Icon: FreeHandSelectionIcon,
        },
      ]}
    />
  );
};
