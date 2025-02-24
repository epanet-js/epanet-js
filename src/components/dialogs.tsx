import dynamic from "next/dynamic";
import { memo, Suspense, useCallback } from "react";
import { useAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { match } from "ts-pattern";
import * as D from "@radix-ui/react-dialog";
import {
  B3Size,
  StyledDialogOverlay,
  StyledDialogContent,
  Loading,
  DefaultErrorBoundary,
  WelcomeDialogContent,
} from "./elements";
import * as dialogState from "src/state/dialog_state";
import { ParserIssues } from "src/import/inp";

const OpenInpDialog = dynamic<{
  modal: dialogState.OpenInpDialogState;
  onClose: () => void;
}>(
  () => import("src/components/dialogs/OpenInp").then((r) => r.OpenInpDialog),
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

const CreateNewDialog = dynamic<{
  onClose: () => void;
}>(() => import("src/components/dialogs/CreateNew").then((r) => r.CreateNew), {
  loading: () => <Loading />,
});

const RunSimulationDialog = dynamic<{
  modal: dialogState.RunSimulationDialogSate;
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

  const onClose = useCallback(() => {
    setDialogState(null);
  }, [setDialogState]);

  const dialogSize: B3Size = "sm";

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
    .with({ type: "cheatsheet" }, () => <CheatsheetDialog />)
    .with({ type: "createNew" }, () => <CreateNewDialog onClose={onClose} />)
    .with({ type: "runSimulation" }, (modal) => (
      <RunSimulationDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "simulationReport" }, () => (
      <SimulationReportDialog onClose={onClose} />
    ))
    .with({ type: "inpIssues" }, ({ issues }) => (
      <InpIssuesDialog issues={issues} onClose={onClose} />
    ))
    .with({ type: "welcome" }, () => <WelcomeDialog onClose={onClose} />)
    .with({ type: "loading" }, () => <Loading />)
    .exhaustive();

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
              onOpenAutoFocus={(e) => e.preventDefault()}
              size={dialogSize}
              widthClasses={
                dialog && dialog.type === "simulationReport"
                  ? "max-w-[80vw]"
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
