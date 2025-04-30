import dynamic from "next/dynamic";
import { memo, Suspense, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { match } from "ts-pattern";
import * as D from "@radix-ui/react-dialog";
import {
  StyledDialogOverlay,
  StyledDialogContent,
  Loading,
  DefaultErrorBoundary,
  WelcomeDialogContent,
} from "./elements";
import * as dialogState from "src/state/dialog_state";
import { ParserIssues } from "src/import/inp";
import { useUserTracking } from "src/infra/user-tracking";

const OpenInpDialog = dynamic<{
  modal: dialogState.OpenInpDialogState;
  onClose: () => void;
}>(
  () => import("src/components/dialogs/OpenInp").then((r) => r.OpenInpDialog),
  {
    loading: () => <Loading />,
  },
);

const UpgradeDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/UpgradeDialog").then((r) => r.UpgradeDialog),
  {
    loading: () => <Loading />,
  },
);

const SymbolizationDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/symbolization-dialog").then(
      (r) => r.SymbolizationDialog,
    ),
  {
    loading: () => <Loading />,
  },
);

const InvalidFilesErrorDialog = dynamic<{
  modal: dialogState.InvalidFilesErrorDialogState;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/InvalidFilesError").then(
      (r) => r.InvalidFilesErrorDialog,
    ),
  {
    loading: () => <Loading />,
  },
);

const InpIssuesDialog = dynamic<{
  issues: ParserIssues;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/InpIssues").then((r) => r.InpIssuesDialog),
  {
    loading: () => <Loading />,
  },
);

const GeocodingNotSupportedDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/InpIssues").then(
      (r) => r.GeocodingNotSupportedDialog,
    ),
  {
    loading: () => <Loading />,
  },
);

const MissingCoordinatesDialog = dynamic<{
  issues: ParserIssues;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/InpIssues").then(
      (r) => r.MissingCoordinatesDialog,
    ),
  {
    loading: () => <Loading />,
  },
);

const CreateNewDialog = dynamic<{
  onClose: () => void;
}>(() => import("src/components/dialogs/CreateNew").then((r) => r.CreateNew), {
  loading: () => <Loading />,
});

const RunSimulationDialog = dynamic<{
  modal: dialogState.SimulationSummaryState;
  onClose: () => void;
}>(
  () =>
    import("src/commands/run-simulation").then((r) => r.RunSimulationDialog),
  {
    loading: () => <Loading />,
  },
);

const SimulationReportDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/commands/show-report").then((r) => r.SimulationReportDialog),
  {
    loading: () => <Loading />,
  },
);

const WelcomeDialog = dynamic<{
  onClose: () => void;
}>(() => import("src/commands/show-welcome").then((r) => r.WelcomeDialog), {
  loading: () => <Loading />,
});

const ImportDialog = dynamic<{
  modal: dialogState.DialogStateImport;
  onClose: () => void;
}>(() => import("src/components/dialogs/import").then((r) => r.ImportDialog), {
  loading: () => <Loading />,
});

const UnsavedChangesDialog = dynamic<{
  onContinue: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/UnsavedChangesDialog").then(
      (r) => r.UnsavedChangesDialog,
    ),
  {
    loading: () => <Loading />,
  },
);

const AlertInpOutputDialog = dynamic<{
  onContinue: () => void;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/AlertInpOutput").then(
      (r) => r.AlertInpOutputDialog,
    ),
  {
    loading: () => <Loading />,
  },
);

const CheatsheetDialog = dynamic<Record<string, never>>(
  () =>
    import("src/components/dialogs/cheatsheet").then((r) => r.CheatsheetDialog),
  {
    loading: () => <Loading />,
  },
);

export const Dialogs = memo(function Dialogs() {
  const [dialog, setDialogState] = useAtom(dialogAtom);
  const userTracking = useUserTracking();

  const onClose = useCallback(() => {
    setDialogState(null);
  }, [setDialogState]);

  const content = match(dialog)
    .with(null, () => null)
    .with({ type: "import" }, (modal) => (
      <ImportDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "unsavedChanges" }, ({ onContinue }) => (
      <UnsavedChangesDialog onContinue={onContinue} onClose={onClose} />
    ))
    .with({ type: "alertInpOutput" }, ({ onContinue }) => (
      <AlertInpOutputDialog onContinue={onContinue} onClose={onClose} />
    ))
    .with({ type: "openInp" }, (modal) => (
      <OpenInpDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "invalidFilesError" }, (modal) => (
      <InvalidFilesErrorDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "cheatsheet" }, () => <CheatsheetDialog />)
    .with({ type: "createNew" }, () => <CreateNewDialog onClose={onClose} />)
    .with({ type: "simulationSummary" }, (modal) => (
      <RunSimulationDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "upgrade" }, () => <UpgradeDialog onClose={onClose} />)
    .with({ type: "symbolization" }, () => (
      <SymbolizationDialog onClose={onClose} />
    ))
    .with({ type: "simulationReport" }, () => (
      <SimulationReportDialog onClose={onClose} />
    ))
    .with({ type: "inpIssues" }, ({ issues }) => (
      <InpIssuesDialog issues={issues} onClose={onClose} />
    ))
    .with({ type: "inpGeocodingNotSupported" }, () => (
      <GeocodingNotSupportedDialog onClose={onClose} />
    ))
    .with({ type: "inpMissingCoordinates" }, ({ issues }) => (
      <MissingCoordinatesDialog issues={issues} onClose={onClose} />
    ))
    .with({ type: "welcome" }, () => <WelcomeDialog onClose={onClose} />)
    .with({ type: "loading" }, () => <Loading />)
    .exhaustive();

  const previousDialog = useRef<dialogState.DialogState>(null);

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
      if (dialog.type === "inpGeocodingNotSupported") {
        userTracking.capture({ name: "geocodingNotSupported.seen" });
      }
      if (dialog.type === "inpIssues") {
        userTracking.capture({ name: "inpIssues.seen" });
      }
      if (dialog.type === "simulationSummary") {
        userTracking.capture({
          name: "simulationSummary.seen",
          status: dialog.status,
          duration: dialog.duration,
        });
      }
    }
    previousDialog.current = dialog;
  }

  return (
    <D.Root
      open={!!content}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      {/** Weird as hell shit here. Without this trigger, radix will
      return focus to the body element, which will not receive events. */}
      <D.Trigger className="hidden">
        <div className="hidden"></div>
      </D.Trigger>
      <D.Portal>
        <StyledDialogOverlay />
        <Suspense fallback={<Loading />}>
          {/**radix complains if no title, so at least having an empty one helps**/}
          <D.Title></D.Title>
          {/**radix complains if no description, so at least having an empty one helps**/}
          <D.Description></D.Description>
          {dialog && dialog.type === "welcome" && (
            <WelcomeDialogContent>
              <DefaultErrorBoundary>{content}</DefaultErrorBoundary>
            </WelcomeDialogContent>
          )}
          {(!dialog || dialog.type !== "welcome") && (
            <StyledDialogContent
              onEscapeKeyDown={(e) => {
                onClose();
                e.preventDefault();
                e.stopPropagation();
              }}
              onOpenAutoFocus={(e) => e.preventDefault()}
              size={"sm"}
              widthClasses={
                dialog && dialog.type === "simulationReport"
                  ? "max-w-[80vw]"
                  : dialog && dialog.type === "upgrade"
                    ? "w-full max-w-[924px] p-6"
                    : undefined
              }
            >
              <DefaultErrorBoundary>{content}</DefaultErrorBoundary>
            </StyledDialogContent>
          )}
        </Suspense>
      </D.Portal>
    </D.Root>
  );
});
