import {
  DownloadIcon,
  FileTextIcon,
  VercelLogoIcon,
  StretchHorizontallyIcon,
  CursorArrowIcon,
  LightningBoltIcon,
  AspectRatioIcon,
  KeyboardIcon as DeprecatedKeyboardIcon,
  ResetIcon,
  CircleIcon as DeprecatedCircleIcon,
  GlobeIcon as DeprecatedGlobeIcon,
  StarIcon,
} from "@radix-ui/react-icons";
import { memo } from "react";
import { Button } from "./elements";
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
  SaveIcon,
  EarlyAccessIcon,
  ReservoirIcon,
  UndoIcon,
  RunSimulationIcon,
  JunctionIcon,
} from "src/icons";
import { PipeIcon } from "src/icons/custom-icons/pipe-icon";

export const NothingSelected = memo(function NothingSelected() {
  const translate = useTranslate();
  const openInpFromFs = useOpenInpFromFs();
  const saveInp = useSaveInp();
  const showShortcuts = useShowShortcuts();
  const userTracking = useUserTracking();
  const isSmOrLarger = useBreakpoint("sm");
  const openModelBuilder = useOpenModelBuilder();
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

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
        <div className="pt-1">
          {isLucideIconsOn ? <MouseCursorDefaultIcon /> : <CursorArrowIcon />}
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
            <div className="pt-1">
              {isLucideIconsOn ? <ReservoirIcon /> : <VercelLogoIcon />}
            </div>
            <div>{translate("onboardingDrawReservoir")}</div>
            <div className="pt-1">
              {isLucideIconsOn ? <JunctionIcon /> : <DeprecatedCircleIcon />}
            </div>
            <div>{translate("onboardingDrawJunctions")}</div>
            <div className="pt-1">
              {isLucideIconsOn ? <PipeIcon /> : <StretchHorizontallyIcon />}
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
        <div className="pt-1">
          {isLucideIconsOn ? <RunSimulationIcon /> : <LightningBoltIcon />}
        </div>
        <div>{translate("onboardingRunSimulation")}</div>
        <div className="pt-1">
          {isLucideIconsOn ? <TabsIcon /> : <AspectRatioIcon />}
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
            <div className="pt-1">
              {isLucideIconsOn ? <KeyboardIcon /> : <DeprecatedKeyboardIcon />}
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
            <div className="pt-1">
              {isLucideIconsOn ? <UndoIcon /> : <ResetIcon />}
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
            {isLucideIconsOn ? <FileSpreadsheetIcon /> : <FileTextIcon />}
            {translate("openProject")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              void openModelBuilder({ source: "onboarding" });
            }}
          >
            {isLucideIconsOn ? <GlobeIcon /> : <DeprecatedGlobeIcon />}
            {translate("importFromGIS")}
            {isLucideIconsOn ? (
              <EarlyAccessIcon size="s" className="ml-1" />
            ) : (
              <StarIcon className="w-3 h-3 ml-1" />
            )}
          </Button>
          <Button
            type="button"
            onClick={() => {
              void saveInp({ source: "onboarding" });
            }}
          >
            {isLucideIconsOn ? <SaveIcon /> : <DownloadIcon />}
            {translate("save")}
          </Button>
        </div>
      </div>
    </div>
  );
});
