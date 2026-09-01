import { useRef } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";
import { PipeLibrarySidebar } from "./pipe-library-sidebar";
import { PipeRoughnessTable } from "./pipe-roughness-table";
import { PipeErrorBanner } from "./pipe-error-banner";
import { VerticalResizer } from "../vertical-resizer";
import { WarningActionBanner } from "../warning-action-banner";
import { ImportOutcomeReport } from "src/components/import-outcome-report";
import { ChevronDownIcon, PipeLibraryIcon } from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { validateMaterial } from "src/hydraulic-model/pipe-materials";
import { usePipeLibraryHandlers } from "./use-pipe-library-handlers";

const IMPORT_KEYS = "pipeLibrary.import";

export const PipeLibraryDialog = () => {
  const dialogActions = useRef<DialogActionsHandle>(null);
  const {
    translate,
    draftMaterials,
    selectedLabel,
    handleSelectMaterial,
    selectedMaterial,
    isEmpty,
    hasChanges,
    invalidMaterialLabels,
    sidebarWidth,
    setSidebarWidth,
    pendingImport,
    handleSave,
    handleAddMaterial,
    handleRenameMaterial,
    handleDuplicateMaterial,
    handleDeleteMaterial,
    handleEntriesChange,
    handleExportCsv,
    handleExportXlsx,
    requestImportFromFile,
    requestImportFromModel,
    handleAcceptImport,
    handleCancelImport,
    handleClose,
    importOutcome,
    handleDismissImportOutcome,
  } = usePipeLibraryHandlers();

  const showMenuBar = pendingImport === null;

  return (
    <BaseDialog
      title={translate("pipeLibrary.menuLabel")}
      size="lg"
      height="xl"
      isOpen={true}
      onClose={() => dialogActions.current?.closeDialog()}
      footer={
        <DialogActions
          ref={dialogActions}
          readOnly={false}
          hasChanges={hasChanges}
          onSave={handleSave}
          onClose={handleClose}
          saveDisabled={invalidMaterialLabels.size > 0}
        />
      }
    >
      <div className="flex flex-col flex-1 min-h-0">
        {showMenuBar && (
          <div className="flex items-center px-4 py-2 border-b h-12">
            <div className="flex items-center gap-2 ml-auto">
              <ExportSubmenu
                handleExportCsv={handleExportCsv}
                handleExportXlsx={handleExportXlsx}
              />
              <ImportSubmenu
                handleImportFromModel={requestImportFromModel}
                handleImportFromFile={requestImportFromFile}
              />
            </div>
          </div>
        )}
        {pendingImport !== null && (
          <WarningActionBanner
            description={translate("pipeLibrary.import.confirmMessage")}
            onContinue={handleAcceptImport}
            onCancel={handleCancelImport}
          />
        )}
        <div className="flex-1 flex min-h-0">
          <div className="shrink-0 flex">
            <PipeLibrarySidebar
              width={sidebarWidth}
              materials={draftMaterials}
              selectedLabel={selectedLabel}
              invalidMaterialLabels={invalidMaterialLabels}
              onSelectMaterial={handleSelectMaterial}
              onAddMaterial={handleAddMaterial}
              onRenameMaterial={handleRenameMaterial}
              onDuplicateMaterial={handleDuplicateMaterial}
              onDeleteMaterial={handleDeleteMaterial}
            />
            <VerticalResizer
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
            />
          </div>
          <div className="flex-1 flex flex-col min-h-0 w-full">
            {importOutcome && (
              <ImportOutcomeReport
                outcome={importOutcome}
                translationKeys={IMPORT_KEYS}
                onDismiss={handleDismissImportOutcome}
              />
            )}
            {selectedMaterial ? (
              <>
                <PipeRoughnessTable
                  key={selectedMaterial.label}
                  entries={selectedMaterial.entries}
                  onChange={handleEntriesChange}
                />
                <PipeErrorBanner
                  materialLabel={selectedMaterial.label}
                  error={validateMaterial(selectedMaterial)}
                />
              </>
            ) : isEmpty ? (
              <EmptyState />
            ) : (
              <NoSelectionState />
            )}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};

const ImportSubmenu = ({
  handleImportFromFile,
  handleImportFromModel,
}: {
  handleImportFromFile: () => void;
  handleImportFromModel: () => void;
}) => {
  const translate = useTranslate();

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button variant="default" size="sm">
          {translate("pipeLibrary.importMenu")}
          <ChevronDownIcon />
        </Button>
      </DD.Trigger>
      <DDContent align="end">
        <StyledItem onSelect={handleImportFromModel}>
          {translate("pipeLibrary.importFromModel")}
        </StyledItem>
        <StyledItem onSelect={handleImportFromFile}>
          {translate("pipeLibrary.importFromFile")}
        </StyledItem>
      </DDContent>
    </DD.Root>
  );
};

const ExportSubmenu = ({
  handleExportCsv,
  handleExportXlsx,
}: {
  handleExportCsv: () => void;
  handleExportXlsx: () => void;
}) => {
  const translate = useTranslate();

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button variant="default" size="sm">
          {translate("pipeLibrary.export")}
          <ChevronDownIcon />
        </Button>
      </DD.Trigger>
      <DDContent align="end">
        <StyledItem onSelect={handleExportCsv}>
          {translate("pipeLibrary.exportCsv")}
        </StyledItem>
        <StyledItem onSelect={handleExportXlsx}>
          {translate("pipeLibrary.exportXlsx")}
        </StyledItem>
      </DDContent>
    </DD.Root>
  );
};

const NoSelectionState = () => {
  const translate = useTranslate();
  return (
    <div className="flex-1 flex items-center justify-center p-2">
      <div className="flex flex-col items-center justify-center px-4">
        <div className="text-subtle">
          <PipeLibraryIcon size={96} />
        </div>
        <p className="text-size-base text-subtle text-center max-w-64 py-4">
          {translate("pipeLibrary.noSelection")}
        </p>
      </div>
    </div>
  );
};

const EmptyState = () => {
  const translate = useTranslate();
  return (
    <div className="flex-1 flex items-center justify-center p-2">
      <div className="flex flex-col items-center justify-center px-4">
        <div className="text-subtle">
          <PipeLibraryIcon size={96} />
        </div>
        <p className="text-size-base font-semibold py-4 text-subtle">
          {translate("pipeLibrary.emptyTitle")}
        </p>
        <p className="text-size-base text-subtle text-center max-w-64">
          {translate("pipeLibrary.emptyDescription")}
        </p>
      </div>
    </div>
  );
};
