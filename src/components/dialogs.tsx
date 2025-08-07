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
} from "./elements";
import * as dialogState from "src/state/dialog";
import { ParserIssues } from "src/import/inp";
import { useUserTracking } from "src/infra/user-tracking";
import { SimulationSettingsDialog } from "./dialogs/simulation-settings";
import { LoadingDialog } from "./dialog";

const OpenInpDialog = dynamic<{
  modal: dialogState.OpenInpDialogState;
  onClose: () => void;
}>(
  () => import("src/components/dialogs/open-inp").then((r) => r.OpenInpDialog),
  {
    loading: () => <Loading />,
  },
);

const UpgradeDialog = dynamic<{
  onClose: () => void;
}>(
  () => import("src/components/dialogs/upgrade").then((r) => r.UpgradeDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const InvalidFilesErrorDialog = dynamic<{
  modal: dialogState.InvalidFilesErrorDialogState;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/invalid-files-error").then(
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
    import("src/components/dialogs/inp-issues").then((r) => r.InpIssuesDialog),
  {
    loading: () => <Loading />,
  },
);

const GeocodingNotSupportedDialog = dynamic<{
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/inp-issues").then(
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
    import("src/components/dialogs/inp-issues").then(
      (r) => r.MissingCoordinatesDialog,
    ),
  {
    loading: () => <Loading />,
  },
);

const CreateNewDialog = dynamic<{
  onClose: () => void;
}>(() => import("src/components/dialogs/create-new").then((r) => r.CreateNew), {
  loading: () => <Loading />,
});

const SimulationReportDialog = dynamic(
  () =>
    import("src/components/dialogs/simulation-report").then(
      (r) => r.SimulationReportDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const WelcomeDialog = dynamic(
  () => import("src/components/dialogs/welcome").then((r) => r.WelcomeDialog),
  {
    loading: () => <LoadingDialog />,
  },
);

const SimulationSummaryDialog = dynamic<{
  modal: dialogState.SimulationSummaryState;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/simulation-summary").then(
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
    import("src/components/dialogs/unsaved-changes").then(
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
    import("src/components/dialogs/alert-inp-output").then(
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

const UnexpectedErrorDialog = dynamic<{
  modal: dialogState.UnexpectedErrorDialogState;
  onClose: () => void;
}>(
  () =>
    import("src/components/dialogs/unexpected-error").then(
      (r) => r.UnexpectedErrorDialog,
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
    import("src/components/dialogs/import-customer-points-wizard").then(
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
    import("src/components/dialogs/model-builder-iframe").then(
      (r) => r.ModelBuilderIframeDialog,
    ),
  {
    loading: () => <LoadingDialog />,
  },
);

const EarlyAccessDialog = dynamic<{
  onContinue: () => void;
  afterSignupDialog?: string;
}>(
  () =>
    import("src/components/dialogs/early-access").then(
      (r) => r.EarlyAccessDialog,
    ),
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
      if (dialog.type === "unexpectedError") {
        userTracking.capture({ name: "unexpectedError.seen" });
      }
    }
    previousDialog.current = dialog;
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
  if (dialog.type === "loading") {
    return <LoadingDialog />;
  }

  if (dialog.type === "upgrade") {
    return <UpgradeDialog onClose={onClose} />;
  }

  const content = match(dialog)
    .with({ type: "unsavedChanges" }, ({ onContinue }) => (
      <UnsavedChangesDialog onContinue={onContinue} onClose={onClose} />
    ))
    .with({ type: "alertInpOutput" }, ({ onContinue }) => (
      <AlertInpOutputDialog onContinue={onContinue} onClose={onClose} />
    ))
    .with({ type: "earlyAccess" }, ({ onContinue, afterSignupDialog }) => (
      <EarlyAccessDialog
        onContinue={onContinue}
        afterSignupDialog={afterSignupDialog}
      />
    ))
    .with({ type: "openInp" }, (modal) => (
      <OpenInpDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "invalidFilesError" }, (modal) => (
      <InvalidFilesErrorDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "cheatsheet" }, () => <CheatsheetDialog />)
    .with({ type: "createNew" }, () => <CreateNewDialog onClose={onClose} />)
    .with({ type: "inpIssues" }, ({ issues }) => (
      <InpIssuesDialog issues={issues} onClose={onClose} />
    ))
    .with({ type: "inpGeocodingNotSupported" }, () => (
      <GeocodingNotSupportedDialog onClose={onClose} />
    ))
    .with({ type: "inpMissingCoordinates" }, ({ issues }) => (
      <MissingCoordinatesDialog issues={issues} onClose={onClose} />
    ))
    .exhaustive();

  //DEPRECATED PATH! NEW DIALOGS SHOW USE DialogContainer COMPONENT
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
          {dialog && (
            <StyledDialogContent
              onEscapeKeyDown={(e) => {
                onClose();
                e.preventDefault();
                e.stopPropagation();
              }}
              onOpenAutoFocus={(e) => e.preventDefault()}
              size={"sm"}
            >
              <DefaultErrorBoundary>{content}</DefaultErrorBoundary>
            </StyledDialogContent>
          )}
        </Suspense>
      </D.Portal>
    </D.Root>
  );
});
