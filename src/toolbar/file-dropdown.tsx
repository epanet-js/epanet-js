import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FileAddIcon,
  FileSpreadsheetIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeIcon,
  EarlyAccessIcon,
  NewFromExampleIcon,
  OutdatedSimulationIcon,
  DownloadIcon,
  SaveIcon,
  SaveAllIcon,
} from "src/icons";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useOpenProject } from "src/commands/open-project";
import { useSaveInp } from "src/commands/save-inp";
import { useSaveProject } from "src/commands/save-project";
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
} from "src/components/elements";

export const FileDropdown = () => {
  const createNewProject = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const openProject = useOpenProject();
  const showWelcome = useShowWelcome();
  const openModelBuilder = useOpenModelBuilder();
  const saveInp = useSaveInp();
  const saveProject = useSaveProject();
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const isExportOn = useFeatureFlag("FLAG_EXPORT");

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-12 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root>
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet">
                {isOurFileOn ? <FolderIcon /> : <FileAddIcon />}
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent
              align="start"
              side="bottom"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
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

              {isOurFileOn && <DDSeparator />}

              {isOurFileOn && (
                <StyledItem
                  onSelect={() => {
                    openProject({ source: "toolbar" });
                  }}
                >
                  <FolderOpenIcon />
                  {translate("openProject")}
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-purple-100 text-purple-700 rounded-full">
                    {translate("newBadge")}
                  </span>
                </StyledItem>
              )}

              {isOurFileOn && <DDSeparator />}

              {isOurFileOn && (
                <StyledItem
                  onSelect={() => {
                    void saveProject({ source: "toolbar" });
                  }}
                >
                  <SaveIcon />
                  {translate("save")}
                </StyledItem>
              )}

              {isOurFileOn && (
                <StyledItem
                  onSelect={() => {
                    void saveProject({ source: "toolbar", isSaveAs: true });
                  }}
                >
                  <SaveAllIcon />
                  {translate("saveAs")}
                </StyledItem>
              )}

              {isOurFileOn && <DDSeparator />}

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
                {isOurFileOn ? translate("importINP") : translate("openINP")}
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

              {isOurFileOn && <DDSeparator />}

              {isOurFileOn && (
                <StyledItem
                  onSelect={() => {
                    setDialogState({
                      type: "alertExportInp",
                      onSaveProject: () => {
                        void saveProject({ source: "toolbar" });
                      },
                      onExportAnyway: () => {
                        void saveInp({ source: "toolbar", isSaveAs: true });
                      },
                    });
                  }}
                >
                  <DownloadIcon />
                  {translate("exportINP")}
                </StyledItem>
              )}

              {isExportOn && (
                <StyledItem
                  onSelect={() => {
                    setDialogState({ type: "exportData" });
                  }}
                >
                  <DownloadIcon />
                  {translate("exportData")}
                </StyledItem>
              )}

              <RecentFilesMenu isOurFileOn={isOurFileOn} />
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <StyledTooltipArrow />
        {isOurFileOn ? translate("file") : translate("createNew")}
      </TContent>
    </Tooltip.Root>
  );
};

const RecentFilesMenu = ({ isOurFileOn }: { isOurFileOn: boolean }) => {
  const openRecentFile = useOpenRecentFile();
  const translate = useTranslate();
  const { recentFiles, isSupported: isRecentFilesSupported } = useRecentFiles();

  const showRecentFiles = isRecentFilesSupported && recentFiles.length > 0;

  if (!showRecentFiles) return null;

  return (
    <>
      <DDSeparator />
      <DD.Sub>
        <DDSubTriggerItem>
          <OutdatedSimulationIcon />
          {isOurFileOn ? translate("recent") : translate("recentNetworks")}
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
