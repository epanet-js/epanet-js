import { useRef } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";
import { PipeLibrarySidebar } from "./pipe-library-sidebar";
import { PipeRoughnessTable } from "./pipe-roughness-table";
import { PipeErrorBanner } from "./pipe-error-banner";
import { VerticalResizer } from "../vertical-resizer";
import { ChevronDownIcon, CloseIcon, PipeLibraryIcon } from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { validateMaterial } from "src/lib/pipe-library";
import { usePipeLibraryHandlers } from "./use-pipe-library-handlers";

export const PipeLibraryDialog = () => {
  const dialogActions = useRef<DialogActionsHandle>(null);
  const {
    translate,
    draftMaterials,
    selectedLabel,
    setSelectedLabel,
    selectedMaterial,
    isEmpty,
    hasChanges,
    invalidMaterialLabels,
    hasValidationErrors,
    sidebarWidth,
    setSidebarWidth,
    pendingImport,
    handleSave,
    handleApplyRoughness,
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
    showBanner,
    handleDismissBanner,
  } = usePipeLibraryHandlers();

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
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <Button
            variant="default"
            size="sm"
            disabled={isEmpty || hasValidationErrors}
            onClick={handleApplyRoughness}
          >
            {translate("pipeLibrary.applyRoughness")}
          </Button>
          <div className="flex items-center gap-2">
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
        {showBanner && (
          <DismissableBanner
            description={showBanner.description}
            variant={showBanner.variant}
            onDismiss={handleDismissBanner}
          />
        )}
        {pendingImport !== null && (
          <ImportWarningBanner
            onAccept={handleAcceptImport}
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
              onSelectMaterial={setSelectedLabel}
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
              <div className="flex-1 flex items-center justify-center p-2">
                <EmptyState />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-2">
                <NoSelectionState />
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};

const ImportWarningBanner = ({
  onAccept,
  onCancel,
}: {
  onAccept: () => void;
  onCancel: () => void;
}) => {
  const translate = useTranslate();
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-error-subtle">
      <p className="text-size-base">
        {translate("pipeLibrary.import.confirmMessage")}
      </p>
      <div className="flex gap-2">
        <Button variant="default" size="sm" disabled={false} onClick={onCancel}>
          {translate("pipeLibrary.import.cancel")}
        </Button>
        <Button variant="danger" size="sm" disabled={false} onClick={onAccept}>
          {translate("pipeLibrary.import.continue")}
        </Button>
      </div>
    </div>
  );
};

const DismissableBanner = ({
  description,
  variant,
  onDismiss,
}: {
  description: string;
  variant: "default" | "warning" | "error" | "success";
  onDismiss: () => void;
}) => (
  <div
    className={`flex items-center justify-between px-4 py-2 border-b bg-${variant}-subtle`}
  >
    <p className="text-size-base">{description}</p>
    <div className="flex gap-2">
      <Button variant="quiet" size="sm" disabled={false} onClick={onDismiss}>
        <CloseIcon />
      </Button>
    </div>
  </div>
);

const ImportSubmenu = ({
  handleImportFromFile,
  handleImportFromModel,
}: {
  handleImportFromFile: () => void;
  handleImportFromModel: () => void;
}) => {
  const translate = useTranslate();
  const isExportOn = useFeatureFlag("FLAG_EXPORT_PIPE_LIBRARY");

  if (!isExportOn) {
    return (
      <Button variant="default" size="sm" onClick={handleImportFromModel}>
        {translate("pipeLibrary.importFromModel")}
      </Button>
    );
  }

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
  const isExportOn = useFeatureFlag("FLAG_EXPORT_PIPE_LIBRARY");

  if (!isExportOn) return null;

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
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-subtle">
        <PipeLibraryIcon size={96} />
      </div>
      <p className="text-size-base text-subtle text-center max-w-64 py-4">
        {translate("pipeLibrary.noSelection")}
      </p>
    </div>
  );
};

const EmptyState = () => {
  const translate = useTranslate();
  return (
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
  );
};
