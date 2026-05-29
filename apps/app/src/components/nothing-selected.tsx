import { memo } from "react";
import { Keycap } from "./elements";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";

import {
  MouseCursorDefaultIcon,
  PointerClickIcon,
  PolygonalSelectionIcon,
  SearchIcon,
} from "src/icons";
import { drawingModeShorcuts } from "src/commands/set-drawing-mode";
import { Mode } from "src/state/mode";
import { selectionModeShortcut } from "src/commands/set-area-selection-mode";
import { SEARCH_KEYBINDING } from "src/dialogs/cheatsheet";

export const NothingSelected = memo(function NothingSelected() {
  const translate = useTranslate();

  return (
    <div className="grow flex flex-col items-center justify-center px-4 pb-4">
      <div className="text-subtle">
        <PointerClickIcon size={96} />
      </div>
      <p className="text-size-base font-semibold py-4 text-subtle">
        {translate("nothingSelectedTitle")}
      </p>
      <div
        className="grid gap-x-2 gap-y-4 items-start text-size-base text-subtle max-w-64"
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
        <div className="flex items-center gap-1">
          <SearchIcon />
          <span>/</span>
          <Keycap size="xs">{localizeKeybinding(SEARCH_KEYBINDING)}</Keycap>
        </div>
        <div>{translate("nothingSelectedSearch")}</div>
      </div>
    </div>
  );
});
