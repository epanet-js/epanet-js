import { memo } from "react";
import { Keycap } from "./elements";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";

import {
  MouseCursorDefaultIcon,
  PointerClickIcon,
  PolygonalSelectionIcon,
} from "src/icons";
import { drawingModeShorcuts } from "src/commands/set-drawing-mode";
import { Mode } from "src/state/mode";
import { selectionModeShortcut } from "src/commands/set-area-selection-mode";

export const NothingSelected = memo(function NothingSelected() {
  const translate = useTranslate();

  return (
    <div className="flex-grow flex flex-col items-center justify-center px-4 pb-4">
      <div className="text-gray-400">
        <PointerClickIcon size={96} />
      </div>
      <p className="text-sm font-semibold py-4 text-gray-600">
        {translate("nothingSelectedTitle")}
      </p>
      <div
        className="grid gap-x-2 gap-y-4 items-start text-sm text-gray-600 max-w-64"
        style={{ gridTemplateColumns: "min-content 1fr" }}
      >
        <div className="flex items-center gap-1">
          <MouseCursorDefaultIcon />
          <span>/</span>
          <Keycap size="xs">
            {localizeKeybinding(drawingModeShorcuts[Mode.NONE])}
          </Keycap>
        </div>
        <div>{translate("nothingSelectedClickToSelect")}</div>
        <div className="flex items-center gap-1">
          <PolygonalSelectionIcon />
          <span>/</span>
          <Keycap size="xs">{localizeKeybinding(selectionModeShortcut)}</Keycap>
        </div>
        <div>{translate("nothingSelectedAreaSelect")}</div>
      </div>
    </div>
  );
});
