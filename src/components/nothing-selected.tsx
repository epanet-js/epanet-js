import { memo } from "react";
import { Button, Keycap } from "./elements";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useSaveInp } from "src/commands/save-inp";
import { useUserTracking } from "src/infra/user-tracking";
import { useShowShortcuts } from "src/commands/show-shortcuts";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

import {
  FileSpreadsheetIcon,
  GlobeIcon,
  TabsIcon,
  KeyboardIcon,
  MouseCursorDefaultIcon,
  PointerClickIcon,
  SaveIcon,
  EarlyAccessIcon,
  ReservoirIcon,
  UndoIcon,
  RunSimulationIcon,
  JunctionIcon,
  PipeIcon,
} from "src/icons";
import { drawingModeShorcuts } from "src/commands/set-drawing-mode";
import { Mode } from "src/state/mode";
import { selectionModeShortcut } from "src/commands/set-area-selection-mode";

export const NothingSelected = memo(function NothingSelected() {
  const translate = useTranslate();
  const openInpFromFs = useOpenInpFromFs();
  const saveInp = useSaveInp();
  const showShortcuts = useShowShortcuts();
  const userTracking = useUserTracking();
  const isSmOrLarger = useBreakpoint("sm");
  const openModelBuilder = useOpenModelBuilder();
  const removeTutorial = useFeatureFlag("FLAG_REMOVE_TUTORIAL");

  if (removeTutorial) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center px-4 pb-4">
        <div className="text-gray-400">
          <PointerClickIcon size={96} />
        </div>
        <div className="text-sm py-4 text-gray-600 max-w-64 space-y-2">
          <p className="font-semibold">{translate("nothingSelectedTitle")}</p>
          <p className="leading-6">
            <Keycap size="xs" className="inline-block">
              {localizeKeybinding(drawingModeShorcuts[Mode.NONE])}
            </Keycap>{" "}
            {translate("nothingSelectedClickToSelect")}
          </p>
          <p className="leading-6">
            <Keycap size="xs" className="inline-block">
              {localizeKeybinding(selectionModeShortcut)}
            </Keycap>{" "}
            {translate("nothingSelectedAreaSelect")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 overflow-y-auto pb-4 text-gray-900 dark:text-gray-300 flex-auto placemark-scrollbar">
      <div className="text-sm font-semibold pb-2">
        {translate("onboardingViewAndEdit")}
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-[.125rem]">
          <MouseCursorDefaultIcon />
        </div>
        <div>{translate("onboardingSelectAsset")}</div>
      </div>
      {isSmOrLarger && (
        <>
          <div className="text-sm font-semibold pb-2">
            {translate("onboardingSelectDrawing", "")}
          </div>
          <div
            className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
            style={{
              gridTemplateColumns: "min-content 1fr",
            }}
          >
            <div className="pt-[.125rem]">
              <ReservoirIcon />
            </div>
            <div>{translate("onboardingDrawReservoir")}</div>
            <div className="pt-[.125rem]">
              <JunctionIcon />
            </div>
            <div>{translate("onboardingDrawJunctions")}</div>
            <div className="pt-[.125rem]">
              <PipeIcon />
            </div>
            <div>{translate("onboardingDrawPipe")}</div>
          </div>
        </>
      )}
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingRunningModel")}
        </div>
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-[.125rem]">
          <RunSimulationIcon />
        </div>
        <div>{translate("onboardingRunSimulation")}</div>
        <div className="pt-[.125rem]">
          <TabsIcon />
        </div>
        <div>{translate("onboardingMap")}</div>
      </div>
      {isSmOrLarger && (
        <>
          <div className="pt-4 space-y-3">
            <div className="text-sm font-semibold pb-2">
              {translate("onboardingOtherFeatures")}
            </div>
          </div>
          <div
            className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
            style={{
              gridTemplateColumns: "min-content 1fr",
            }}
          >
            <div className="pt-[.125rem]">
              <KeyboardIcon />
            </div>
            <a
              href="#"
              className="!text-purple-800 hover:underline cursor:pointer"
              onClick={() => {
                userTracking.capture({
                  name: "shortcuts.opened",
                  source: "onboarding",
                });
                showShortcuts();
              }}
            >
              {translate("keyboardShortcuts")}
            </a>
            <div className="pt-[.125rem]">
              <UndoIcon />
            </div>
            <div>
              {translate(
                "onboardingUndoRedo",
                localizeKeybinding("ctrl+z"),
                localizeKeybinding("ctrl+y"),
              )}
            </div>
          </div>
        </>
      )}
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingFiles")}
        </div>
        <div className="flex flex-col items-start gap-y-2">
          <Button
            type="button"
            onClick={() => {
              void openInpFromFs({ source: "onboarding" });
            }}
          >
            <FileSpreadsheetIcon />
            {translate("openProject")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              void openModelBuilder({ source: "onboarding" });
            }}
          >
            <GlobeIcon />
            {translate("importFromGIS")}
            <EarlyAccessIcon size="sm" className="ml-1" />
          </Button>
          <Button
            type="button"
            onClick={() => {
              void saveInp({ source: "onboarding" });
            }}
          >
            <SaveIcon />
            {translate("save")}
          </Button>
        </div>
      </div>
    </div>
  );
});
