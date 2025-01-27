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
} from "./elements";
import * as dialogState from "src/state/dialog_state";

const OpenInpDialog = dynamic<{
  modal: dialogState.OpenInpDialogState;
  onClose: () => void;
}>(
  () => import("src/components/dialogs/OpenInp").then((r) => r.OpenInpDialog),
  {
    loading: () => <Loading />,
  },
);

const ImportDialog = dynamic<{
  modal: dialogState.DialogStateImport;
  onClose: () => void;
}>(() => import("src/components/dialogs/import").then((r) => r.ImportDialog), {
  loading: () => <Loading />,
});

const ExportDialog = dynamic<{
  onClose: () => void;
}>(() => import("src/components/dialogs/export").then((r) => r.ExportDialog), {
  loading: () => <Loading />,
});

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
    .with({ type: "openInp" }, (modal) => (
      <OpenInpDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "export" }, () => <ExportDialog onClose={onClose} />)
    .with({ type: "cheatsheet" }, () => <CheatsheetDialog />)
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
          <StyledDialogContent
            onOpenAutoFocus={(e) => e.preventDefault()}
            size={dialogSize}
          >
            <DefaultErrorBoundary>{content}</DefaultErrorBoundary>
          </StyledDialogContent>
        </Suspense>
      </D.Portal>
    </D.Root>
  );
});
