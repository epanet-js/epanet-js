import React from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FileBoxIcon,
  FilePlusCornerIcon,
  FileSpreadsheetIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeIcon,
  EarlyAccessIcon,
  OutdatedSimulationIcon,
  SaveIcon,
  SaveAllIcon,
  FileTextIcon,
  ImportCustomerPointsIcon,
  FolderInputIcon,
  FolderOutputIcon,
  ZonesIcon,
} from "src/icons";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useOpenProject } from "src/commands/open-project";
import { useSaveInp } from "src/commands/save-inp";
import { useSaveProject } from "src/commands/save-project";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useOpenRecentFile } from "src/commands/open-recent-file";
import { projectExtension } from "src/commands/save-project";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useImportCustomerPoints } from "src/commands/import-customer-points";
import { useOpenZonesImport } from "src/commands/open-zones-import";
import { useImportZonesDisabled } from "src/hooks/use-import-zones-disabled";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useRecentFiles } from "src/hooks/use-recent-files";
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
  const openProject = useOpenProject();
  const saveProject = useSaveProject();
  const translate = useTranslate();

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-12 group bn flex items-stretch py-1 focus:outline-hidden">
        <DD.Root>
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet">
                <FolderIcon />
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
              <NewProjectSubmenu />

              <DDSeparator />

              <StyledItem
                onSelect={() => {
                  openProject({ source: "toolbar" });
                }}
              >
                <FolderOpenIcon />
                {translate("openFile")}
              </StyledItem>

              <DDSeparator />

              <StyledItem
                onSelect={() => {
                  void saveProject({ source: "toolbar" });
                }}
              >
                <SaveIcon />
                {translate("save")}
              </StyledItem>

              <StyledItem
                onSelect={() => {
                  void saveProject({ source: "toolbar", isSaveAs: true });
                }}
              >
                <SaveAllIcon />
                {translate("saveAs")}
              </StyledItem>

              <DDSeparator />

              <ImportSubmenu />
              <ExportSubmenu />
              <RecentFilesMenu />
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <StyledTooltipArrow />
        {translate("file")}
      </TContent>
    </Tooltip.Root>
  );
};

const NewProjectSubmenu = () => {
  const createNewProject = useNewProject();
  const openModelBuilder = useOpenModelBuilder();
  const openInpFromFs = useOpenInpFromFs();
  const userTracking = useUserTracking();
  const translate = useTranslate();

  return (
    <DD.Sub>
      <DDSubTriggerItem>
        <FilePlusCornerIcon />
        {translate("newProject")}
        <ChevronRightIcon size="sm" className="ml-auto" />
      </DDSubTriggerItem>
      <DD.Portal>
        <DDSubContent sideOffset={4} alignOffset={-4}>
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
            {translate("newProject.blank")}
          </StyledItem>

          <StyledItem
            onSelect={() => {
              openModelBuilder({ source: "toolbar" });
            }}
          >
            <GlobeIcon />
            {translate("newProject.fromGIS")}
            <EarlyAccessIcon size="sm" />
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
            {translate("newProject.fromEpanetInp")}
          </StyledItem>
        </DDSubContent>
      </DD.Portal>
    </DD.Sub>
  );
};

const ImportSubmenu = () => {
  const importCustomerPoints = useImportCustomerPoints();
  const openZonesImport = useOpenZonesImport();
  const importZonesDisabled = useImportZonesDisabled();
  const isImportZonesMenuOn = useFeatureFlag("FLAG_IMPORT_ZONES_MENU");
  const translate = useTranslate();

  return (
    <DD.Sub>
      <DDSubTriggerItem>
        <FolderOutputIcon />
        {translate("import")}
        <ChevronRightIcon size="sm" className="ml-auto" />
      </DDSubTriggerItem>
      <DD.Portal>
        <DDSubContent sideOffset={4} alignOffset={-4}>
          <StyledItem
            onSelect={() => {
              importCustomerPoints({ source: "toolbar" });
            }}
          >
            <ImportCustomerPointsIcon />
            {translate("importCustomerPoints.menuEntry")}
          </StyledItem>

          {isImportZonesMenuOn && (
            <StyledItem
              disabled={importZonesDisabled}
              className={importZonesDisabled ? "opacity-60" : undefined}
              onSelect={() => {
                openZonesImport({ source: "toolbar" });
              }}
            >
              <ZonesIcon />
              {translate("importZones.menuTitle")}
            </StyledItem>
          )}
        </DDSubContent>
      </DD.Portal>
    </DD.Sub>
  );
};

const ExportSubmenu = () => {
  const saveInp = useSaveInp();
  const saveProject = useSaveProject();
  const setDialogState = useSetAtom(dialogAtom);
  const translate = useTranslate();

  return (
    <DD.Sub>
      <DDSubTriggerItem>
        <FolderInputIcon />
        {translate("export")}
        <ChevronRightIcon size="sm" className="ml-auto" />
      </DDSubTriggerItem>
      <DD.Portal>
        <DDSubContent sideOffset={4} alignOffset={-4}>
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
            <FileSpreadsheetIcon />
            {translate("export.epanetInp")}
          </StyledItem>
          <StyledItem
            onSelect={() => {
              setDialogState({ type: "exportAssetData" });
            }}
          >
            <FileTextIcon />
            {translate("export.assetData")}
          </StyledItem>
          <StyledItem
            onSelect={() => {
              setDialogState({ type: "exportTimeSeries" });
            }}
          >
            <FileTextIcon />
            {translate("export.simulationResults")}
          </StyledItem>
        </DDSubContent>
      </DD.Portal>
    </DD.Sub>
  );
};

const RecentFilesMenu = () => {
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
          {translate("recent")}
          <ChevronRightIcon size="sm" className="ml-auto" />
        </DDSubTriggerItem>
        <DD.Portal>
          <DDSubContent sideOffset={4} alignOffset={-4}>
            {recentFiles.map((entry) => {
              const isProject = entry.name
                .toLowerCase()
                .endsWith(projectExtension);
              return (
                <StyledItem
                  key={entry.id}
                  onSelect={() => openRecentFile(entry, "toolbar")}
                >
                  {isProject ? <FileBoxIcon /> : <FileSpreadsheetIcon />}
                  {entry.name}
                </StyledItem>
              );
            })}
          </DDSubContent>
        </DD.Portal>
      </DD.Sub>
    </>
  );
};
