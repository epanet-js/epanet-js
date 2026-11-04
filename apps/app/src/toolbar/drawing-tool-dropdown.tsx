import { useCycleDrawingMode } from "src/commands/set-drawing-mode";
import { useTranslate } from "src/hooks/use-translate";
import { lastDrawingModeAtom, MODE_INFO } from "src/state/mode";
import { DRAWING_MODE_OPTIONS } from "./modes";
import { ToolWithOptions } from "./tool-with-options";

export const DrawingToolDropdown = ({
  disabled = false,
}: {
  disabled?: boolean;
}) => {
  const translate = useTranslate();
  const cycleDrawingMode = useCycleDrawingMode();

  return (
    <ToolWithOptions
      label={translate("drawingTools")}
      lastModeAtom={lastDrawingModeAtom}
      cycleMode={cycleDrawingMode}
      disabled={disabled}
      options={DRAWING_MODE_OPTIONS.map(({ mode, Icon }) => ({
        mode,
        label: translate(MODE_INFO[mode].name),
        Icon,
      }))}
    />
  );
};
