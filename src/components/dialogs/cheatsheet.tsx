import { DialogHeader } from "src/components/dialog";
import { Keycap } from "src/components/elements";
import React, { Fragment } from "react";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { showSimulationSettingsShortcut } from "src/commands/show-simulation-settings";
import { getIsMac } from "src/infra/i18n/mac";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { KeyboardIcon } from "src/icons";
import { toggleNetworkReviewShortcut } from "src/commands/toggle-network-review";
import { toggleSidePanelShortcut } from "src/commands/toggle-side-panel";
import { selectionModeShortcut } from "src/commands/set-area-selection-mode";
import { changeActiveTopologyShortcut } from "src/commands/change-selected-assets-active-topology-status";

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
  "3": translate("reservoir"),
  "4": translate("tank"),
  "5": translate("pipe"),
  "6": translate("pump"),
  "7": translate("valve"),
  Esc: `${translate("exit")} / ${translate("clearSelection")}`,
  [selectionModeShortcut]: translate("areaSelection.tool"),
  "Command+a": translate("selectAll"),
  "Command+z": translate("undo"),
  "Command+y": translate("redo"),
  [toggleSidePanelShortcut]: translate("toggleSidePanel"),
  [toggleNetworkReviewShortcut]: translate("networkReview.toggle"),
});

const getBindingsWithActiveTopology = (
  translate: ReturnType<typeof useTranslate>,
) => ({
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
  [selectionModeShortcut]: translate("areaSelection.tool"),
  "2": translate("junction"),
  "3": translate("reservoir"),
  "4": translate("tank"),
  "5": translate("pipe"),
  "6": translate("pump"),
  "7": translate("valve"),
  Esc: `${translate("exit")} / ${translate("clearSelection")}`,
  [changeActiveTopologyShortcut]: translate("toggleActiveTopology"),
  BACKSPACE: translate("delete"),
  "Command+a": translate("selectAll"),
  "Command+z": translate("undo"),
  "Command+y": translate("redo"),
  [toggleSidePanelShortcut]: translate("toggleSidePanel"),
  [toggleNetworkReviewShortcut]: translate("networkReview.toggle"),
});

export function CheatsheetDialog() {
  const translate = useTranslate();
  const isMac = useFeatureFlag("FLAG_MAC");
  const isBulkActiveTopologyEnabled = useFeatureFlag(
    "FLAG_BULK_ACTIVE_TOPOLOGY",
  );

  const BINDINGS = isBulkActiveTopologyEnabled
    ? getBindingsWithActiveTopology(translate)
    : getBindings(translate);
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
