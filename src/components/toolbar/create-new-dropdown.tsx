import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  FileIcon,
  FilePlusIcon,
  SunIcon,
  GlobeIcon,
  FileTextIcon,
  StarIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons";
import {
  ChevronDown,
  File,
  FilePlus,
  FileSpreadsheet,
  Globe,
  Star,
  Sun,
} from "lucide-react";
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
                    <FilePlus size={16} />
                    <ChevronDown size={12} />
                  </>
                ) : (
                  <>
                    <FilePlusIcon />
                    <ChevronDownIcon className="w-3 h-3 text-gray-500" />
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
                {isLucideIconsOn ? <File size={16} /> : <FileIcon />}
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
                {isLucideIconsOn ? <Sun size={16} /> : <SunIcon />}
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
                {isLucideIconsOn ? (
                  <FileSpreadsheet size={16} />
                ) : (
                  <FileTextIcon />
                )}
                {translate("openINP")}
              </StyledItem>

              <StyledItem
                onSelect={() => {
                  openModelBuilder({ source: "toolbar" });
                }}
              >
                {isLucideIconsOn ? <Globe size={16} /> : <GlobeIcon />}
                {translate("importFromGIS")}
                {isLucideIconsOn ? (
                  <Star size={12} />
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
