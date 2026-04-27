import dynamic from "next/dynamic";
import { memo, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { match } from "ts-pattern";
import * as dialogState from "src/state/dialog";
import type { Projection } from "src/lib/projections";
import { ParserIssues } from "src/import/inp";
import { useUserTracking } from "src/infra/user-tracking";
import { LoadingDialog } from "../components/dialog";
import { WelcomeDialog } from "./welcome";
import { ExampleModelsDialog } from "./example-models";

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

const ExportDataDialog = dynamic<{
  onClose: () => void;
}>(() => import("src/dialogs/export-data").then((r) => r.ExportDataDialog), {
  loading: () => <LoadingDialog />,
});

const FirstScenarioDialog = dynamic<{
  onConfirm: () => void;
  onClose: () => void;
}>(
  () => import("src/dialogs/first-scenario").then((r) => r.FirstScenarioDialog),
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
      if (dialog.type === "unexpectedError") {
        userTracking.capture({ name: "unexpectedError.seen" });
      }
      if (dialog.type === "featurePaywall") {
        userTracking.capture({ name: "paywall.seen", feature: dialog.feature });
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
  if (dialog.type === "importCustomerPointsWizard") {
    return <ImportCustomerPointsWizard isOpen={true} onClose={onClose} />;
  }
  if (dialog.type === "modelBuilderIframe") {
    return <ModelBuilderIframeDialog onClose={onClose} />;
  }
  if (dialog.type === "unexpectedError") {
    return <UnexpectedErrorDialog modal={dialog} onClose={onClose} />;
  }
  if (dialog.type === "welcome") {
    return <WelcomeDialog />;
  }
  if (dialog.type === "examples") {
    return <ExampleModelsDialog />;
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

  if (dialog.type === "upgrade") {
    return <UpgradeDialog onClose={onClose} />;
  }

  if (dialog.type === "featurePaywall") {
    if (dialog.feature === "scenarios") {
      return <ScenariosPaywallConnector onClose={onClose} />;
    }
    if (dialog.feature === "customLayers") {
      return <CustomLayersPaywallConnector onClose={onClose} />;
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

  if (dialog.type === "exportData") {
    return <ExportDataDialog onClose={onClose} />;
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
    .with({ type: "inpIssues" }, ({ issues }) => (
      <InpIssuesDialog issues={issues} onClose={onClose} />
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
    .exhaustive();

  return content;
});
