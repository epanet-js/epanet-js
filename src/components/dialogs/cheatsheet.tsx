import { DialogHeader, DialogContainer } from "src/components/dialog";
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

type KeybordShortcut = string;
type TranslationKey = string;

type Shortcut = {
  binding: KeybordShortcut;
  description: TranslationKey | TranslationKey[];
};

type ShortcutSection = {
  group: TranslationKey;
  shortcuts: Shortcut[];
};

const getBindings = (): ShortcutSection[] => [
  {
    group: "keyboardShortcuts.fileManagement",
    shortcuts: [
      { binding: "Alt+N", description: "newProject" },
      { binding: "Command+O", description: "openProject" },
      { binding: "Command+S", description: "save" },
      { binding: "Command+Shift+S", description: "saveAs" },
    ],
  },
  {
    group: "keyboardShortcuts.interface",
    shortcuts: [
      { binding: "B", description: "toggleSatellite" },
      {
        binding: toggleSidePanelShortcut,
        description: "toggleSidePanel",
      },
      {
        binding: toggleNetworkReviewShortcut,
        description: "networkReview.toggle",
      },
      { binding: "?", description: "keyboardShortcuts.title" },
    ],
  },
  {
    group: "keyboardShortcuts.mapTools",
    shortcuts: [
      { binding: "1", description: "select" },
      { binding: "2", description: "junction" },
      { binding: "3", description: "reservoir" },
      { binding: "4", description: "tank" },
      { binding: "5", description: "pipe" },
      { binding: "6", description: "pump" },
      { binding: "7", description: "valve" },
    ],
  },
  {
    group: "keyboardShortcuts.simulation",
    shortcuts: [
      { binding: "Shift+Enter", description: "simulate" },
      {
        binding: showSimulationSettingsShortcut,
        description: "simulationSettings",
      },
      { binding: "Alt+R", description: "viewReport" },
    ],
  },
  {
    group: "keyboardShortcuts.editingSelection",
    shortcuts: [
      {
        binding: selectionModeShortcut,
        description: "areaSelection.tool",
      },
      { binding: "Command+a", description: "selectAll" },
      {
        binding: changeActiveTopologyShortcut,
        description: "toggleActiveTopology",
      },
      {
        binding: "Esc",
        description: ["exit", "clearSelection"],
      },
      { binding: "BACKSPACE", description: "delete" },
      { binding: "Command+z", description: "undo" },
      { binding: "Command+y", description: "redo" },
    ],
  },
];

const getBindingsWithActiveTopology = (): ShortcutSection[] => [
  {
    group: "keyboardShortcuts.fileManagement",
    shortcuts: [
      { binding: "Alt+N", description: "newProject" },
      { binding: "Command+O", description: "openProject" },
      { binding: "Command+S", description: "save" },
      { binding: "Command+Shift+S", description: "saveAs" },
    ],
  },
  {
    group: "keyboardShortcuts.interface",
    shortcuts: [
      { binding: "B", description: "toggleSatellite" },
      {
        binding: toggleSidePanelShortcut,
        description: "toggleSidePanel",
      },
      {
        binding: toggleNetworkReviewShortcut,
        description: "networkReview.toggle",
      },
      { binding: "?", description: "keyboardShortcuts.title" },
    ],
  },
  {
    group: "keyboardShortcuts.mapTools",
    shortcuts: [
      { binding: "1", description: "select" },
      { binding: "2", description: "junction" },
      { binding: "3", description: "reservoir" },
      { binding: "4", description: "tank" },
      { binding: "5", description: "pipe" },
      { binding: "6", description: "pump" },
      { binding: "7", description: "valve" },
    ],
  },
  {
    group: "shortcuts.simulation",
    shortcuts: [
      { binding: "Shift+Enter", description: "simulate" },
      {
        binding: showSimulationSettingsShortcut,
        description: "simulationSettings",
      },
      { binding: "Alt+R", description: "viewReport" },
    ],
  },
  {
    group: "keyboardShortcuts.editingSelection",
    shortcuts: [
      {
        binding: selectionModeShortcut,
        description: "areaSelection.tool",
      },
      { binding: "Command+a", description: "selectAll" },
      {
        binding: changeActiveTopologyShortcut,
        description: "toggleActiveTopology",
      },
      {
        binding: "Esc",
        description: ["exit", "clearSelection"],
      },
      { binding: "BACKSPACE", description: "delete" },
      { binding: "Command+z", description: "undo" },
      { binding: "Command+y", description: "redo" },
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
        title={translate("keyboardShortcuts.title")}
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
    ? getBindingsWithActiveTopology()
    : getBindings();

  return (
    <DialogContainer size="md">
      <DialogHeader
        title={translate("keyboardShortcuts.title")}
        titleIcon={KeyboardIcon}
      />
      <div className="columns-3">
        {BINDINGS.map((section) => (
          <div key={section.group} className="break-inside-avoid mb-6">
            <h2 className="text-sm font-bold mb-2 text-gray-700">
              {translate(section.group)}
            </h2>
            <div className="space-y-2">
              {section.shortcuts.map((item) => (
                <div key={item.binding} className="flex items-start gap-2">
                  <Keycap className="w-16 flex-shrink-0">
                    {localizeKeybinding(item.binding, isMac || getIsMac())}
                  </Keycap>
                  <p className="text-xs pt-1">
                    {Array.isArray(item.description)
                      ? item.description.map((k) => translate(k)).join(" / ")
                      : translate(item.description)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DialogContainer>
  );
}
