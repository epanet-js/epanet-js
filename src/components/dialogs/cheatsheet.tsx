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

const oldGetBindings = (translate: ReturnType<typeof useTranslate>) => ({
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

const oldGetBindingsWithActiveTopology = (
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

const getBindings = (translate: ReturnType<typeof useTranslate>) => [
  {
    group: "File management",
    shortcuts: [
      { binding: "Alt+N", description: translate("newProject") },
      { binding: "Command+O", description: translate("openProject") },
      { binding: "Command+S", description: translate("save") },
      { binding: "Command+Shift+S", description: translate("saveAs") },
    ],
  },
  {
    group: "Map tools",
    shortcuts: [
      { binding: "1", description: translate("select") },
      { binding: "2", description: translate("junction") },
      { binding: "3", description: translate("reservoir") },
      { binding: "4", description: translate("tank") },
      { binding: "5", description: translate("pipe") },
      { binding: "6", description: translate("pump") },
      { binding: "7", description: translate("valve") },
    ],
  },
  {
    group: "Editing & selection",
    shortcuts: [
      { binding: "Command+a", description: translate("selectAll") },
      {
        binding: "Esc",
        description: `${translate("exit")} / ${translate("clearSelection")}`,
      },
      { binding: "BACKSPACE", description: translate("delete") },
      { binding: "Command+z", description: translate("undo") },
      { binding: "Command+y", description: translate("redo") },
    ],
  },
  {
    group: "Interface",
    shortcuts: [
      { binding: "B", description: translate("toggleSatellite") },
      {
        binding: [toggleSidePanelShortcut],
        description: translate("toggleSidePanel"),
      },
      {
        binding: [toggleNetworkReviewShortcut],
        description: translate("networkReview.toggle"),
      },
      { binding: "?", description: translate("keyboardShortcuts") },
    ],
  },
  {
    group: "Simulation",
    shortcuts: [
      { binding: "Shift+Enter", description: translate("simulate") },
      {
        binding: [showSimulationSettingsShortcut],
        description: translate("simulationSettings"),
      },
      { binding: "Alt+R", description: translate("viewReport") },
    ],
  },
];
const getBindingsWithActiveTopology = (
  translate: ReturnType<typeof useTranslate>,
) => [
  {
    group: "File management",
    shortcuts: [
      { binding: "Alt+N", description: translate("newProject") },
      { binding: "Command+O", description: translate("openProject") },
      { binding: "Command+S", description: translate("save") },
      { binding: "Command+Shift+S", description: translate("saveAs") },
    ],
  },
  {
    group: "Interface",
    shortcuts: [
      { binding: "B", description: translate("toggleSatellite") },
      {
        binding: [toggleSidePanelShortcut],
        description: translate("toggleSidePanel"),
      },
      {
        binding: [toggleNetworkReviewShortcut],
        description: translate("networkReview.toggle"),
      },
      { binding: "?", description: translate("keyboardShortcuts") },
    ],
  },
  {
    group: "Map tools",
    shortcuts: [
      { binding: "1", description: translate("select") },
      { binding: "2", description: translate("junction") },
      { binding: "3", description: translate("reservoir") },
      { binding: "4", description: translate("tank") },
      { binding: "5", description: translate("pipe") },
      { binding: "6", description: translate("pump") },
      { binding: "7", description: translate("valve") },
    ],
  },
  {
    group: "Simulation",
    shortcuts: [
      { binding: "Shift+Enter", description: translate("simulate") },
      {
        binding: [showSimulationSettingsShortcut],
        description: translate("simulationSettings"),
      },
      { binding: "Alt+R", description: translate("viewReport") },
    ],
  },
  {
    group: "Editing & selection",
    shortcuts: [
      {
        binding: [selectionModeShortcut],
        description: translate("areaSelection.tool"),
      },
      { binding: "Command+a", description: translate("selectAll") },
      {
        binding: [changeActiveTopologyShortcut],
        description: translate("toggleActiveTopology"),
      },
      {
        binding: "Esc",
        description: `${translate("exit")} / ${translate("clearSelection")}`,
      },
      { binding: "BACKSPACE", description: translate("delete") },
      { binding: "Command+z", description: translate("undo") },
      { binding: "Command+y", description: translate("redo") },
    ],
  },
];

export function OldCheatsheetDialog() {
  const translate = useTranslate();
  const isMac = useFeatureFlag("FLAG_MAC");
  const isBulkActiveTopologyEnabled = useFeatureFlag(
    "FLAG_BULK_ACTIVE_TOPOLOGY",
  );

  const BINDINGS = isBulkActiveTopologyEnabled
    ? oldGetBindingsWithActiveTopology(translate)
    : oldGetBindings(translate);
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
      <div className="grid gap-4 grid-cols-3">
        {BINDINGS.map((section) => (
          /* OUTER LOOP: Renders the Group Container */
          <div key={section.group} className="mb-6">
            {/* The Group Header */}
            <h3 className="text-lg font-bold mb-2 text-gray-700">
              {section.group}
            </h3>

            {/* INNER LOOP: Renders the actual shortcuts */}
            <div className="space-y-2">
              {section.shortcuts.map((item) => (
                <div
                  key={
                    Array.isArray(item.binding)
                      ? item.binding.join(",")
                      : item.binding
                  }
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    {/* Note: changed 'key' to 'item.binding' based on new data */}
                    <Keycap>
                      {localizeKeybinding(
                        Array.isArray(item.binding)
                          ? item.binding[0]
                          : item.binding,
                        isMac || getIsMac(),
                      )}
                    </Keycap>
                  </div>
                  <p className="text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
