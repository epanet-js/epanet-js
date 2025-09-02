import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  FileIcon as DeprecatedFileIcon,
  FilePlusIcon,
  SunIcon,
  GlobeIcon as DeprecatedGlobeIcon,
  FileTextIcon,
  StarIcon,
  ChevronDownIcon as DeprecatedChevronDownIcon,
} from "@radix-ui/react-icons";

import {
  ChevronDownIcon,
  FileIcon,
  FileAddIcon,
  FileSpreadsheetIcon,
  GlobeIcon,
  EarlyAccessIcon,
  NewFromExampleIcon,
} from "src/icons";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useShowWelcome } from "src/commands/show-welcome";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import {
  Button,
  DDContent,
  StyledItem,
  TContent,
  StyledTooltipArrow,
} from "../elements";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const CreateNewDropdown = () => {
  const createNewProject = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const showWelcome = useShowWelcome();
  const openModelBuilder = useOpenModelBuilder();
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-12 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root>
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet">
                {isLucideIconsOn ? (
                  <>
                    <FileAddIcon />
                    <ChevronDownIcon size="s" />
                  </>
                ) : (
                  <>
                    <FilePlusIcon />
                    <DeprecatedChevronDownIcon className="w-3 h-3 text-gray-500" />
                  </>
                )}
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
                {isLucideIconsOn ? <FileIcon /> : <DeprecatedFileIcon />}
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
                {isLucideIconsOn ? <NewFromExampleIcon /> : <SunIcon />}
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
                {isLucideIconsOn ? <FileSpreadsheetIcon /> : <FileTextIcon />}
                {translate("openINP")}
              </StyledItem>

              <StyledItem
                onSelect={() => {
                  openModelBuilder({ source: "toolbar" });
                }}
              >
                {isLucideIconsOn ? <GlobeIcon /> : <DeprecatedGlobeIcon />}
                {translate("importFromGIS")}
                {isLucideIconsOn ? (
                  <EarlyAccessIcon size="s" />
                ) : (
                  <StarIcon className="w-3 h-3 ml-1" />
                )}
              </StyledItem>
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
