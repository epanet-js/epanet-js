import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  FileIcon,
  FilePlusIcon,
  SunIcon,
  GlobeIcon,
  ChevronDownIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useShowWelcome } from "src/commands/show-welcome";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useUserTracking } from "src/infra/user-tracking";
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

  return (
    <Tooltip.Root delayDuration={200}>
      <DD.Root>
        <Tooltip.Trigger asChild>
          <DD.Trigger asChild>
            <Button variant="default" size="sm">
              <PlusIcon />
              <ChevronDownIcon />
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
              Start Blank Project
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
              <SunIcon />
              Start from Example
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
              <FilePlusIcon />
              Import from INP File
            </StyledItem>

            <StyledItem
              onSelect={() => {
                userTracking.capture({
                  name: "gisImport.started",
                  source: "toolbar",
                });
                openModelBuilder({ source: "toolbar" });
              }}
            >
              <GlobeIcon />
              Import from GIS Data
            </StyledItem>
          </DDContent>
        </DD.Portal>
      </DD.Root>
      <TContent side="bottom">
        <StyledTooltipArrow />
        Create new...
      </TContent>
    </Tooltip.Root>
  );
};
