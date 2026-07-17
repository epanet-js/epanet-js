import { memo, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { recoverableSessionAtom } from "src/state/session-recovery";
import { match } from "ts-pattern";
import * as dialogState from "src/state/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { LoadingDialog } from "../components/dialog";
import { WelcomeDialog } from "./welcome";
import { SessionRecoveryDialog } from "./session-recovery";
import { AppLoadFailedDialog } from "./app-load-failed";
import { SimulationSettingsDialog } from "src/dialogs/simulation-settings";
import { UpgradeDialog } from "src/dialogs/upgrade";
import { InvalidFilesErrorDialog } from "src/dialogs/invalid-files-error";
import {
  InpIssuesDialog,
  MissingCoordinatesDialog,
  MalformedCoordinatesDialog,
} from "src/dialogs/inp-issues";
import { NetworkProjectionDialog } from "src/dialogs/network-projection";
import { CreateNew as CreateNewDialog } from "src/dialogs/create-new";
import { SimulationReportDialog } from "src/dialogs/simulation-report";
import { SimulationSummaryDialog } from "src/dialogs/simulation-summary";
import { SimulationOutOfMemoryDialog } from "src/dialogs/simulation-out-of-memory";
import { UnsavedChangesDialog } from "src/dialogs/unsaved-changes";
import { AlertInpOutputDialog } from "src/dialogs/alert-inp-output";
import { AlertExportInpDialog } from "src/dialogs/alert-export-inp";
import { ProjectSavedInfoDialog } from "src/dialogs/project-saved-info";
import { FileFormatUpdatedDialog } from "src/dialogs/file-format-updated";
import { AlertScenariosNotSavedDialog } from "src/dialogs/alert-scenarios-not-saved";
import { AlertNetworkRequiredDialog } from "src/dialogs/alert-network-required";
import { CheatsheetDialog } from "src/dialogs/cheatsheet";
import { UnexpectedErrorDialog } from "src/dialogs/unexpected-error";
import { ChangeNotAppliedDialog } from "src/dialogs/change-not-applied";
import { ImportCustomerPointsWizard } from "src/dialogs/import-customer-points-wizard";
import { ModelBuilderIframeDialog } from "src/dialogs/model-builder-iframe";
import { ModelBuilderV2IframeDialog } from "src/dialogs/model-builder-v2-iframe";
import { ModelBuilderPaywallDialog } from "src/dialogs/model-builder-paywall";
import { EarlyAccessDialog } from "src/dialogs/early-access";
import { ImportCustomerPointsWarningDialog } from "src/dialogs/import-customer-points-warning";
import { ImportZonesWarningDialog } from "src/dialogs/import-zones-warning";
import { SimulationProgressDialog } from "src/dialogs/simulation-progress";
import { OpenProjectProgressDialog } from "src/dialogs/open-project-progress";
import { ControlsDialog } from "src/dialogs/controls-dialog";
import { PatternsDialog } from "src/dialogs/patterns";
import { PipeLibraryDialog } from "src/dialogs/pipe-library";
import { PumpLibraryDialog } from "src/dialogs/pump-library";
import { CurveLibraryDialog } from "src/dialogs/curves";
import { CustomAttributesDialog } from "src/dialogs/custom-attributes";
import { DeleteScenarioConfirmationDialog } from "src/dialogs/delete-scenario-confirmation";
import { RenameScenarioDialog } from "src/dialogs/rename-scenario";
import { ScenariosPaywallConnector } from "src/dialogs/paywall/scenarios-connector";
import { ElevationsPaywallConnector } from "src/dialogs/paywall/elevations-connector";
import { CustomLayersPaywallConnector } from "src/dialogs/paywall/custom-layers-connector";
import { ZonesPaywallConnector } from "src/dialogs/paywall/zones-connector";
import { PipeLibraryPaywallConnector } from "src/dialogs/paywall/pipe-library-connector";
import { CustomAttributesPaywallConnector } from "src/dialogs/paywall/custom-attributes-connector";
import { ElevationTileErrorsDialog } from "src/dialogs/elevation-tile-errors";
import { GisImportErrorsDialog } from "src/dialogs/gis-import-errors";
import { ActivatingTrialDialog } from "src/dialogs/activating-trial";
import { ExportAssetDataDialog } from "src/dialogs/export-asset-data";
import { ExportSimulationResultsDialog as ExportTimeSeriesDialog } from "src/dialogs/export-simulation-results";
import { FirstScenarioDialog } from "src/dialogs/first-scenario";
import { ProfileNoPathDialog } from "src/dialogs/profile-no-path";
import { CustomGraphDialog } from "src/dialogs/custom-graph-dialog";
import { PriorityAccessDialog } from "src/dialogs/priority-access";
import { AllocateCustomerPointsDialog } from "src/dialogs/allocate-customer-points";
import { AllocateCustomerPointsWarningDialog } from "src/dialogs/allocate-customer-points-warning";
import { ModelAttributesValidationDialog } from "src/dialogs/model-attributes-validation";
import { ImportZonesDialog } from "src/dialogs/import-zones-wizard";

export const Dialogs = memo(function Dialogs() {
  const [dialog, setDialogState] = useAtom(dialogAtom);
  const recoverableSession = useAtomValue(recoverableSessionAtom);
  const userTracking = useUserTracking();
  const onClose = useCallback(() => {
    setDialogState(null);
  }, [setDialogState]);

  const previousDialog = useRef<dialogState.DialogState>(null);

  if (dialog === null) return null;

  if (dialog.type === "appLoadFailed") {
    return <AppLoadFailedDialog modal={dialog} />;
  }

  if (previousDialog.current !== dialog && !!dialog) {
    if (previousDialog.current?.type !== dialog.type) {
      if (dialog.type === "welcome" && !recoverableSession) {
        userTracking.capture({ name: "welcome.seen" });
      }
      if (dialog.type === "unsavedChanges") {
        userTracking.capture({ name: "unsavedChanges.seen" });
      }
      if (dialog.type === "inpMissingCoordinates") {
        userTracking.capture({ name: "missingCoordinates.seen" });
      }
      if (dialog.type === "inpMalformedCoordinates") {
        userTracking.capture({ name: "malformedCoordinates.seen" });
      }
      if (dialog.type === "networkProjection") {
        userTracking.capture({
          name: "networkProjection.seen",
          source: dialog.source,
        });
      }
      if (dialog.type === "inpIssues") {
        userTracking.capture({ name: "inpIssues.seen" });
      }
      if (dialog.type === "simulationSummary") {
        userTracking.capture({
          name: "simulationSummary.seen",
          status: dialog.status,
          duration: dialog.duration,
          qualityType: dialog.qualityType,
        });
      }
      if (dialog.type === "simulationOutOfMemory") {
        userTracking.capture({ name: "simulationOutOfMemory.seen" });
      }
      if (dialog.type === "unexpectedError") {
        userTracking.capture({ name: "unexpectedError.seen" });
      }
      if (dialog.type === "featurePaywall") {
        userTracking.capture({ name: "paywall.seen", feature: dialog.feature });
      }
      if (dialog.type === "upgrade") {
        userTracking.capture({
          name: "upgradeDialog.seen",
          source: dialog.source?.kind,
          sourceFeature: dialogState.getSourceFeature(dialog.source),
        });
      }
      if (dialog.type === "priorityAccess") {
        userTracking.capture({
          name: "priorityAccess.seen",
          featureName: dialog.featureName,
        });
      }
      if (dialog.type === "modelBuilderPaywall") {
        userTracking.capture({
          name: "modelBuilder.paywall.seen",
          source: dialog.source,
        });
      }
    }
    previousDialog.current = dialog;
  }

  if (dialog.type === "createNew") {
    return <CreateNewDialog />;
  }
  if (dialog.type === "simulationReport") {
    return <SimulationReportDialog />;
  }
  if (dialog.type === "simulationSettings") {
    return <SimulationSettingsDialog />;
  }
  if (dialog.type === "simulationSummary") {
    return <SimulationSummaryDialog modal={dialog} onClose={onClose} />;
  }
  if (dialog.type === "simulationOutOfMemory") {
    return <SimulationOutOfMemoryDialog onClose={onClose} />;
  }
  if (dialog.type === "importCustomerPointsWizard") {
    return <ImportCustomerPointsWizard isOpen={true} onClose={onClose} />;
  }
  if (dialog.type === "allocateCustomerPoints") {
    return <AllocateCustomerPointsDialog isOpen={true} onClose={onClose} />;
  }
  if (dialog.type === "allocateCustomerPointsWarning") {
    return (
      <AllocateCustomerPointsWarningDialog
        onImport={dialog.onImport}
        onClose={onClose}
      />
    );
  }
  if (dialog.type === "modelAttributesValidation") {
    return (
      <ModelAttributesValidationDialog
        issueCount={dialog.issueCount}
        onFixFirst={dialog.onFixFirst}
        onRunAnyway={dialog.onRunAnyway}
        onClose={onClose}
      />
    );
  }
  if (dialog.type === "modelBuilderIframe") {
    return <ModelBuilderIframeDialog onClose={onClose} />;
  }
  if (dialog.type === "modelBuilderV2Iframe") {
    return <ModelBuilderV2IframeDialog onClose={onClose} />;
  }
  if (dialog.type === "modelBuilderPaywall") {
    return (
      <ModelBuilderPaywallDialog source={dialog.source} onClose={onClose} />
    );
  }
  if (dialog.type === "unexpectedError") {
    return <UnexpectedErrorDialog modal={dialog} onClose={onClose} />;
  }
  if (dialog.type === "changeNotApplied") {
    return <ChangeNotAppliedDialog onClose={onClose} />;
  }
  if (dialog.type === "welcome") {
    return recoverableSession ? <SessionRecoveryDialog /> : <WelcomeDialog />;
  }
  if (dialog.type === "loading") {
    return <LoadingDialog />;
  }
  if (dialog.type === "simulationProgress") {
    return <SimulationProgressDialog modal={dialog} />;
  }
  if (dialog.type === "openProjectProgress") {
    return <OpenProjectProgressDialog modal={dialog} />;
  }
  if (dialog.type === "controls") {
    return <ControlsDialog />;
  }
  if (dialog.type === "patternsLibrary") {
    return (
      <PatternsDialog
        initialPatternId={dialog.initialPatternId}
        initialSection={dialog.initialSection}
      />
    );
  }
  if (dialog.type === "pipeLibrary") {
    return <PipeLibraryDialog />;
  }
  if (dialog.type === "pumpLibrary") {
    return (
      <PumpLibraryDialog
        initialCurveId={dialog.initialCurveId}
        initialSection={dialog.initialSection}
      />
    );
  }
  if (dialog.type === "curveLibrary") {
    return (
      <CurveLibraryDialog
        initialCurveId={dialog.initialCurveId}
        initialSection={dialog.initialSection}
      />
    );
  }
  if (dialog.type === "customAttributes") {
    return (
      <CustomAttributesDialog initialAssetType={dialog.initialAssetType} />
    );
  }

  if (dialog.type === "upgrade") {
    return <UpgradeDialog source={dialog.source} />;
  }

  if (dialog.type === "featurePaywall") {
    if (dialog.feature === "scenarios") {
      return <ScenariosPaywallConnector onClose={onClose} />;
    }
    if (dialog.feature === "customLayers") {
      return <CustomLayersPaywallConnector onClose={onClose} />;
    }
    if (dialog.feature === "zones") {
      return <ZonesPaywallConnector onClose={onClose} />;
    }
    if (dialog.feature === "pipeLibrary") {
      return <PipeLibraryPaywallConnector onClose={onClose} />;
    }
    if (dialog.feature === "customAttributes") {
      return <CustomAttributesPaywallConnector onClose={onClose} />;
    }
    return <ElevationsPaywallConnector onClose={onClose} />;
  }

  if (dialog.type === "elevationTileErrors") {
    return (
      <ElevationTileErrorsDialog
        totalCount={dialog.totalCount}
        errors={dialog.errors}
        onClose={onClose}
      />
    );
  }

  if (dialog.type === "gisImportErrors") {
    return (
      <GisImportErrorsDialog
        totalCount={dialog.totalCount}
        errors={dialog.errors}
        onClose={onClose}
      />
    );
  }

  if (dialog.type === "activatingTrial") {
    return <ActivatingTrialDialog />;
  }

  if (dialog.type === "firstScenario") {
    return (
      <FirstScenarioDialog onConfirm={dialog.onConfirm} onClose={onClose} />
    );
  }

  if (dialog.type === "exportAssetData") {
    return <ExportAssetDataDialog onClose={onClose} />;
  }

  if (dialog.type === "exportTimeSeries") {
    return <ExportTimeSeriesDialog onClose={onClose} />;
  }

  if (dialog.type === "customGraph") {
    return <CustomGraphDialog onClose={onClose} />;
  }

  if (dialog.type === "priorityAccess") {
    return (
      <PriorityAccessDialog
        featureName={dialog.featureName}
        onClose={onClose}
      />
    );
  }

  if (dialog.type === "importZones") {
    return <ImportZonesDialog onClose={onClose} />;
  }

  if (dialog.type === "importZonesWarning") {
    return (
      <ImportZonesWarningDialog
        onContinue={dialog.onContinue}
        onClose={onClose}
      />
    );
  }

  if (dialog.type === "networkProjection") {
    return (
      <NetworkProjectionDialog
        source={dialog.source}
        previewGeoJson={dialog.previewGeoJson}
        onImportWithProjection={dialog.onImportWithProjection}
        filename={dialog.filename}
        flowUnits={dialog.flowUnits}
        initialProjection={dialog.initialProjection}
        suggestedXyScale={dialog.suggestedXyScale}
      />
    );
  }

  const content = match(dialog)
    .with({ type: "unsavedChanges" }, ({ onContinue }) => (
      <UnsavedChangesDialog onContinue={onContinue} onClose={onClose} />
    ))
    .with({ type: "alertInpOutput" }, ({ onContinue }) => (
      <AlertInpOutputDialog onContinue={onContinue} onClose={onClose} />
    ))
    .with({ type: "alertExportInp" }, ({ onSaveProject, onExportAnyway }) => (
      <AlertExportInpDialog
        onSaveProject={onSaveProject}
        onExportAnyway={onExportAnyway}
        onClose={onClose}
      />
    ))
    .with({ type: "projectSavedInfo" }, ({ onConfirm, onCancel }) => (
      <ProjectSavedInfoDialog
        onConfirm={onConfirm}
        onCancel={onCancel}
        onClose={onClose}
      />
    ))
    .with({ type: "fileFormatUpdated" }, () => (
      <FileFormatUpdatedDialog onClose={onClose} />
    ))
    .with({ type: "alertScenariosNotSaved" }, ({ onContinue }) => (
      <AlertScenariosNotSavedDialog onContinue={onContinue} onClose={onClose} />
    ))
    .with({ type: "alertNetworkRequired" }, () => (
      <AlertNetworkRequiredDialog onClose={onClose} />
    ))
    .with({ type: "earlyAccess" }, ({ onContinue, afterSignupDialog }) => (
      <EarlyAccessDialog
        onContinue={onContinue}
        afterSignupDialog={afterSignupDialog}
      />
    ))
    .with({ type: "importCustomerPointsWarning" }, ({ onContinue }) => (
      <ImportCustomerPointsWarningDialog
        onContinue={onContinue}
        onClose={onClose}
      />
    ))
    .with({ type: "invalidFilesError" }, () => (
      <InvalidFilesErrorDialog onClose={onClose} />
    ))
    .with({ type: "cheatsheet" }, () => <CheatsheetDialog />)
    .with({ type: "inpIssues" }, ({ issues, onAfterClose }) => (
      <InpIssuesDialog
        issues={issues}
        onClose={() => {
          onClose();
          onAfterClose?.();
        }}
      />
    ))
    .with({ type: "inpMissingCoordinates" }, ({ issues }) => (
      <MissingCoordinatesDialog issues={issues} onClose={onClose} />
    ))
    .with({ type: "inpMalformedCoordinates" }, ({ issues }) => (
      <MalformedCoordinatesDialog issues={issues} onClose={onClose} />
    ))
    .with(
      { type: "deleteScenarioConfirmation" },
      ({ scenarioId, scenarioName, onConfirm }) => (
        <DeleteScenarioConfirmationDialog
          scenarioId={scenarioId}
          scenarioName={scenarioName}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      ),
    )
    .with(
      { type: "renameScenario" },
      ({ scenarioId, currentName, onConfirm }) => (
        <RenameScenarioDialog
          scenarioId={scenarioId}
          currentName={currentName}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      ),
    )
    .with({ type: "profileNoPath" }, () => (
      <ProfileNoPathDialog onClose={onClose} />
    ))
    .exhaustive();

  return content;
});
