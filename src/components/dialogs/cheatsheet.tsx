import { DialogHeader } from "src/components/dialog";
import { Keycap } from "src/components/elements";
import React, { Fragment } from "react";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { KeyboardIcon } from "@radix-ui/react-icons";
import { showSimulationSettingsShortcut } from "src/commands/show-simulation-settings";
import { getIsMac } from "src/infra/i18n/mac";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const SEARCH_KEYBINDING = "Command+k";

const getBindings = (translate: ReturnType<typeof useTranslate>) => ({
  B: translate("toggleSatellite"),
  "Shift+Enter": translate("simulate"),
  [showSimulationSettingsShortcut]: translate("simulationSettings"),
  "Alt+R": translate("viewReport"),
  "Alt+N": translate("newProject"),
  "Command+O": translate("openProject"),
  "Command+S": translate("save"),
  "Command+Shift+S": translate("save"),
  "?": translate("help"),
  "1": translate("select"),
  "2": translate("junction"),
  "3": translate("pipe"),
  "4": translate("reservoir"),
  Esc: `${translate("exit")} / ${translate("clearSelection")}`,
  "Command+a": translate("selectAll"),
  "Command+z": translate("undo"),
  "Command+y": translate("redo"),
});

export function CheatsheetDialog() {
  const translate = useTranslate();
  const isMac = useFeatureFlag("FLAG_MAC");
  const BINDINGS = getBindings(translate);
  return (
    <>
      <DialogHeader
        title={translate("keyboardShortcuts")}
        titleIcon={KeyboardIcon}
      />
      <div
        className="grid gap-x-3 gap-y-2 pb-1"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        {Object.entries(BINDINGS).map(([key, description]) => (
          <Fragment key={key}>
            <div className="">
              <Keycap>{localizeKeybinding(key, isMac || getIsMac())}</Keycap>
            </div>
            <div>{description}</div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
