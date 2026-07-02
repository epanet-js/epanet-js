import dynamic from "next/dynamic";
import { memo, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { match } from "ts-pattern";
import * as dialogState from "src/state/dialog";
import type { Projection } from "src/lib/projections";
import type { CustomAttributeAssetType } from "@epanet-js/custom-attributes";
import { ParserIssues } from "src/import/inp";
import { useUserTracking } from "src/infra/user-tracking";
import { LoadingDialog } from "../components/dialog";
import { WelcomeDialog } from "./welcome";
import { AppLoadFailedDialog } from "./app-load-failed";

const SimulationSettingsDialog = dynamic(
  () =>
    import("src/dialogs/simulation-settings").then(
      (r) => r.SimulationSettingsDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const UpgradeDialog = dynamic<{
  onClose: () => void;
  source?: dialogState.UpgradeSource;
}>(() => import("src/dialogs/upgrade").then((r) => r.UpgradeDialog), {
  loading: () => <LoadingDialog />,
});

const InvalidFilesErrorDialog = dynamic<{
  modal: dialogState.InvalidFilesErrorDialogState;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/invalid-files-error").then(
      (r) => r.InvalidFilesErrorDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const InpIssuesDialog = dynamic<{
  issues: ParserIssues;
  onClose: () => void;
}>(() => import("src/dialogs/inp-issues").then((r) => r.InpIssuesDialog), {
  loading: () => <LoadingDialog />,
});

const NetworkProjectionDialog = dynamic<{
  source: "import" | "map-panel";
  previewGeoJson: import("geojson").FeatureCollection;
  onImportWithProjection: (
    projection: Projection,
    extent?: import("geojson").BBox,
  ) => void;
  filename: string;
  flowUnits: string;
  initialProjection?: import("src/lib/projections").Proj4Projection;
  suggestedXyScale?: number;
}>(
  () =>
    import("src/dialogs/network-projection").then(
      (r) => r.NetworkProjectionDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const MissingCoordinatesDialog = dynamic<{
  issues: ParserIssues;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/inp-issues").then((r) => r.MissingCoordinatesDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const CreateNewDialog = dynamic(
  () => import("src/dialogs/create-new").then((r) => r.CreateNew),
  { loading: () => <LoadingDialog /> },
);

const SimulationReportDialog = dynamic(
  () =>
    import("src/dialogs/simulation-report").then(
      (r) => r.SimulationReportDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const SimulationSummaryDialog = dynamic<{
  modal: dialogState.SimulationSummaryState;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/simulation-summary").then(
      (r) => r.SimulationSummaryDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const SimulationOutOfMemoryDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/simulation-out-of-memory").then(
      (r) => r.SimulationOutOfMemoryDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const UnsavedChangesDialog = dynamic<{
  onContinue: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/unsaved-changes").then((r) => r.UnsavedChangesDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const AlertInpOutputDialog = dynamic<{
  onContinue: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/alert-inp-output").then((r) => r.AlertInpOutputDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const AlertExportInpDialog = dynamic<{
  onSaveProject: () => void;
  onExportAnyway: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/alert-export-inp").then((r) => r.AlertExportInpDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const ProjectSavedInfoDialog = dynamic<{
  onConfirm: () => void;
  onCancel?: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/project-saved-info").then(
      (r) => r.ProjectSavedInfoDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const FileFormatUpdatedDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/file-format-updated").then(
      (r) => r.FileFormatUpdatedDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const AlertScenariosNotSavedDialog = dynamic<{
  onContinue: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/alert-scenarios-not-saved").then(
      (r) => r.AlertScenariosNotSavedDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const AlertNetworkRequiredDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/alert-network-required").then(
      (r) => r.AlertNetworkRequiredDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const CheatsheetDialog = dynamic<Record<string, never>>(
  () => import("src/dialogs/cheatsheet").then((r) => r.CheatsheetDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const UnexpectedErrorDialog = dynamic<{
  modal: dialogState.UnexpectedErrorDialogState;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/unexpected-error").then((r) => r.UnexpectedErrorDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const ChangeNotAppliedDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/change-not-applied").then(
      (r) => r.ChangeNotAppliedDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ImportCustomerPointsWizard = dynamic<{
  isOpen: boolean;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/import-customer-points-wizard").then(
      (r) => r.ImportCustomerPointsWizard,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ModelBuilderIframeDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/model-builder-iframe").then(
      (r) => r.ModelBuilderIframeDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ModelBuilderV2IframeDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/model-builder-v2-iframe").then(
      (r) => r.ModelBuilderV2IframeDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ModelBuilderPaywallDialog = dynamic<{
  source: string;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/model-builder-paywall").then(
      (r) => r.ModelBuilderPaywallDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const EarlyAccessDialog = dynamic<{
  onContinue: () => void;
  afterSignupDialog?: string;
}>(() => import("src/dialogs/early-access").then((r) => r.EarlyAccessDialog), {
  loading: () => <LoadingDialog />,
});

const ImportCustomerPointsWarningDialog = dynamic<{
  onContinue: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/import-customer-points-warning").then(
      (r) => r.ImportCustomerPointsWarningDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ImportZonesWarningDialog = dynamic<{
  onContinue: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/import-zones-warning").then(
      (r) => r.ImportZonesWarningDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const SimulationProgressDialog = dynamic<{
  modal: dialogState.SimulationProgressDialogState;
}>(
  () =>
    import("src/dialogs/simulation-progress").then(
      (r) => r.SimulationProgressDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const OpenProjectProgressDialog = dynamic<{
  modal: dialogState.OpenProjectProgressDialogState;
}>(
  () =>
    import("src/dialogs/open-project-progress").then(
      (r) => r.OpenProjectProgressDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ControlsDialog = dynamic(
  () => import("src/dialogs/controls-dialog").then((r) => r.ControlsDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const PatternsDialog = dynamic<{
  initialPatternId?: number;
  initialSection?:
    | "demand"
    | "reservoirHead"
    | "pumpSpeed"
    | "qualitySourceStrength"
    | "energyPrice";
}>(() => import("src/dialogs/patterns").then((r) => r.PatternsDialog), {
  loading: () => <LoadingDialog />,
});

const PipeLibraryDialog = dynamic(
  () => import("src/dialogs/pipe-library").then((r) => r.PipeLibraryDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const PumpLibraryDialog = dynamic<{
  initialCurveId?: number;
  initialSection?: "pump" | "efficiency";
}>(() => import("src/dialogs/pump-library").then((r) => r.PumpLibraryDialog), {
  loading: () => <LoadingDialog />,
});

const CurveLibraryDialog = dynamic<{
  initialCurveId?: number;
  initialSection?: "volume" | "valve" | "headloss";
}>(() => import("src/dialogs/curves").then((r) => r.CurveLibraryDialog), {
  loading: () => <LoadingDialog />,
});

const CustomAttributesDialog = dynamic<{
  initialAssetType?: CustomAttributeAssetType;
}>(
  () =>
    import("src/dialogs/custom-attributes").then(
      (r) => r.CustomAttributesDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const CustomAttributesInAssetDialog = dynamic<{
  initialAssetType?: CustomAttributeAssetType;
}>(
  () =>
    import("src/dialogs/custom-attributes-in-asset").then(
      (r) => r.CustomAttributesInAssetDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const DeleteScenarioConfirmationDialog = dynamic<{
  scenarioId: string;
  scenarioName: string;
  onConfirm: (scenarioId: string) => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/delete-scenario-confirmation").then(
      (r) => r.DeleteScenarioConfirmationDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const RenameScenarioDialog = dynamic<{
  scenarioId: string;
  currentName: string;
  onConfirm: (scenarioId: string, newName: string) => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/rename-scenario").then((r) => r.RenameScenarioDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const ScenariosPaywallConnector = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/paywall/scenarios-connector").then(
      (r) => r.ScenariosPaywallConnector,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ElevationsPaywallConnector = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/paywall/elevations-connector").then(
      (r) => r.ElevationsPaywallConnector,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const CustomLayersPaywallConnector = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/paywall/custom-layers-connector").then(
      (r) => r.CustomLayersPaywallConnector,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ZonesPaywallConnector = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/paywall/zones-connector").then(
      (r) => r.ZonesPaywallConnector,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const PipeLibraryPaywallConnector = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/paywall/pipe-library-connector").then(
      (r) => r.PipeLibraryPaywallConnector,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ElevationTileErrorsDialog = dynamic<{
  totalCount: number;
  errors: { fileName: string; error: string }[];
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/elevation-tile-errors").then(
      (r) => r.ElevationTileErrorsDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const GisImportErrorsDialog = dynamic<{
  totalCount: number;
  errors: { fileName: string; error: string }[];
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/gis-import-errors").then(
      (r) => r.GisImportErrorsDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ActivatingTrialDialog = dynamic(
  () =>
    import("src/dialogs/activating-trial").then((r) => r.ActivatingTrialDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const ExportAssetDataDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/export-asset-data").then(
      (r) => r.ExportAssetDataDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ExportTimeSeriesDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/export-simulation-results").then(
      (r) => r.ExportSimulationResultsDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const FirstScenarioDialog = dynamic<{
  onConfirm: () => void;
  onClose: () => void;
}>(
  () => import("src/dialogs/first-scenario").then((r) => r.FirstScenarioDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const ProfileNoPathDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/profile-no-path").then((r) => r.ProfileNoPathDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const CustomGraphDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/custom-graph-dialog").then((r) => r.CustomGraphDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const PriorityAccessDialog = dynamic<{
  featureName: string;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/priority-access").then((r) => r.PriorityAccessDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const AllocateCustomerPointsDialog = dynamic<{
  isOpen: boolean;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/allocate-customer-points/index").then(
      (r) => r.AllocateCustomerPointsDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const AllocateCustomerPointsWarningDialog = dynamic<{
  onImport: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/allocate-customer-points-warning").then(
      (r) => r.AllocateCustomerPointsWarningDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ModelAttributesValidationDialog = dynamic<{
  issueCount: number;
  onFixFirst: () => void;
  onRunAnyway: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/model-attributes-validation").then(
      (r) => r.ModelAttributesValidationDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const ImportZonesDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/dialogs/import-zones-wizard").then((r) => r.ImportZonesDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

export const Dialogs = memo(function Dialogs() {
  const [dialog, setDialogState] = useAtom(dialogAtom);
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
      if (dialog.type === "welcome") {
        userTracking.capture({ name: "welcome.seen" });
      }
      if (dialog.type === "unsavedChanges") {
        userTracking.capture({ name: "unsavedChanges.seen" });
      }
      if (dialog.type === "inpMissingCoordinates") {
        userTracking.capture({ name: "missingCoordinates.seen" });
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
    return <WelcomeDialog />;
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
  if (dialog.type === "customAttributesInAsset") {
    return (
      <CustomAttributesInAssetDialog
        initialAssetType={dialog.initialAssetType}
      />
    );
  }

  if (dialog.type === "upgrade") {
    return <UpgradeDialog onClose={onClose} source={dialog.source} />;
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
    .with({ type: "invalidFilesError" }, (modal) => (
      <InvalidFilesErrorDialog modal={modal} onClose={onClose} />
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
