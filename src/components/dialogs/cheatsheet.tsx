import { DialogHeader, DialogContainer } from "src/components/dialog";
import { Keycap } from "src/components/elements";
import React from "react";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { showSimulationSettingsShortcut } from "src/commands/show-simulation-settings";
import { showControlsShortcut } from "src/commands/show-controls";
import { getIsMac } from "src/infra/i18n/mac";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { KeyboardIcon } from "src/icons";
import { toggleNetworkReviewShortcut } from "src/commands/toggle-network-review";
import { toggleSidePanelShortcut } from "src/commands/toggle-side-panel";
import { selectionModeShortcut } from "src/commands/set-area-selection-mode";
import { changeActiveTopologyShortcut } from "src/commands/change-selected-assets-active-topology-status";
import {
  previousTimestepShortcut,
  nextTimestepShortcut,
} from "src/commands/change-timestep";
import {
  toggleScenarioShortcut,
  cycleScenarioShortcut,
} from "src/commands/scenario-shortcuts";
import { createScenarioShortcut } from "src/commands/create-scenario";

export const SEARCH_KEYBINDING = "Command+k";

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

export function CheatsheetDialog() {
  const translate = useTranslate();
  const isMac = useFeatureFlag("FLAG_MAC");
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");

  const BINDINGS: ShortcutSection[] = [
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
          description: "simulationSettings.title",
        },
        { binding: "Alt+R", description: "viewReport" },
        {
          binding: showControlsShortcut,
          description: "controls.title",
        },
        {
          binding: previousTimestepShortcut,
          description: "previousTimestep",
        },
        {
          binding: nextTimestepShortcut,
          description: "nextTimestep",
        },
      ],
    },
    ...(isScenariosOn
      ? [
          {
            group: "keyboardShortcuts.scenarios",
            shortcuts: [
              {
                binding: createScenarioShortcut,
                description: "createScenario",
              },
              {
                binding: cycleScenarioShortcut,
                description: "cycleScenario",
              },
              {
                binding: toggleScenarioShortcut,
                description: "toggleScenario",
              },
            ],
          },
        ]
      : []),
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

  return (
    <DialogContainer size="md">
      <DialogHeader
        title={translate("keyboardShortcuts.title")}
        titleIcon={KeyboardIcon}
      />
      <div className="columns-1 md:columns-2">
        {BINDINGS.map((section) => (
          <div key={section.group} className="break-inside-avoid mb-6">
            <h2 className="text-sm font-bold mb-2 text-gray-700">
              {translate(section.group)}
            </h2>
            <div className="space-y-2">
              {section.shortcuts.map((item) => (
                <div key={item.binding} className="flex items-start gap-4">
                  <Keycap className="w-28 flex-shrink-0">
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
