import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  ChevronDownIcon,
  FileIcon,
  FileAddIcon,
  FileSpreadsheetIcon,
  GlobeIcon,
  EarlyAccessIcon,
  NewFromExampleIcon,
  UploadIcon,
} from "src/icons";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useShowWelcome } from "src/commands/show-welcome";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useOpenArchiveFromFs } from "src/commands/open-archive-from-fs";
import {
  Button,
  DDContent,
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
  const openArchiveFromFs = useOpenArchiveFromFs();

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
                  void openArchiveFromFs();
                }}
              >
                <UploadIcon />
                Open Archive
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
