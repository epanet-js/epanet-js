import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FileAddIcon,
  FileSpreadsheetIcon,
  GlobeIcon,
  EarlyAccessIcon,
  NewFromExampleIcon,
  OutdatedSimulationIcon,
} from "src/icons";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useShowWelcome } from "src/commands/show-welcome";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useOpenRecentFile } from "src/commands/open-recent-file";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  Button,
  DDContent,
  DDSubContent,
  DDSubTriggerItem,
  DDSeparator,
  StyledItem,
  TContent,
  StyledTooltipArrow,
} from "../elements";

export const CreateNewDropdown = () => {
  const createNewProject = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const showWelcome = useShowWelcome();
  const openModelBuilder = useOpenModelBuilder();
  const userTracking = useUserTracking();
  const translate = useTranslate();

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-12 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root>
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet">
                <FileAddIcon />
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent align="start" side="bottom">
              <StyledItem
                onSelect={() => {
                  userTracking.capture({
                    name: "newModel.started",
                    source: "toolbar",
                  });
                  void createNewProject({ source: "toolbar" });
                }}
              >
                <FileIcon />
                {translate("startBlankProject")}
              </StyledItem>

              <StyledItem
                onSelect={() => {
                  userTracking.capture({
                    name: "examples.opened",
                    source: "toolbar",
                  });
                  showWelcome({ source: "toolbar" });
                }}
              >
                <NewFromExampleIcon />
                {translate("startFromExample")}
              </StyledItem>

              <StyledItem
                onSelect={() => {
                  userTracking.capture({
                    name: "openInp.started",
                    source: "toolbar",
                  });
                  void openInpFromFs({ source: "toolbar" });
                }}
              >
                <FileSpreadsheetIcon />
                {translate("openINP")}
              </StyledItem>

              <StyledItem
                onSelect={() => {
                  openModelBuilder({ source: "toolbar" });
                }}
              >
                <GlobeIcon />
                {translate("importFromGIS")}
                <EarlyAccessIcon size="sm" />
              </StyledItem>

              <RecentFilesMenu />
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <StyledTooltipArrow />
        {translate("createNew")}
      </TContent>
    </Tooltip.Root>
  );
};

const RecentFilesMenu = () => {
  const openRecentFile = useOpenRecentFile();
  const translate = useTranslate();
  const { recentFiles, isSupported: isRecentFilesSupported } = useRecentFiles();
  const isRecentFilesOn = useFeatureFlag("FLAG_RECENT_FILES");

  const showRecentFiles =
    isRecentFilesSupported && isRecentFilesOn && recentFiles.length > 0;

  if (!showRecentFiles) return null;

  return (
    <>
      <DDSeparator />
      <DD.Sub>
        <DDSubTriggerItem>
          <OutdatedSimulationIcon />
          {`${translate("recent")}...`}
          <ChevronRightIcon size="sm" className="ml-auto" />
        </DDSubTriggerItem>
        <DD.Portal>
          <DDSubContent sideOffset={4} alignOffset={-4}>
            {recentFiles.map((entry) => (
              <StyledItem
                key={entry.id}
                onSelect={() => openRecentFile(entry, "toolbar")}
              >
                <FileSpreadsheetIcon />
                {entry.name}
              </StyledItem>
            ))}
          </DDSubContent>
        </DD.Portal>
      </DD.Sub>
    </>
  );
};
