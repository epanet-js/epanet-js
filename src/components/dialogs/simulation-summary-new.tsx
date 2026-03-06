import * as Dialog from "@radix-ui/react-dialog";
import { useShowReport } from "src/commands/show-report";
import { SimulationSummaryState } from "src/state/dialog";
import { DialogHeader, DialogHeaderNew, SimpleDialogActions } from "../dialog";
import {
  DefaultErrorBoundary,
  Loading,
  StyledDialogContent,
  StyledDialogContentNew,
  StyledDialogOverlay,
} from "../elements";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

import { Form, Formik } from "formik";
import { ErrorIcon, SuccessIcon, WarningIcon } from "src/icons";

export const SimulationSummaryDialogNew = ({
  modal,
  onClose,
}: {
  modal: SimulationSummaryState;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showReport = useShowReport();
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const ContentShell = isModalsOn
    ? StyledDialogContentNew
    : StyledDialogContent;
  const Header = isModalsOn ? DialogHeaderNew : DialogHeader;

  const handleOpenReport = () => {
    showReport({ source: "resultDialog" });
  };
  const { status, duration } = modal;
  const handleIgnore = () => {
    onClose();
    (modal.onIgnore ?? modal.onContinue)?.();
  };

  let content: React.ReactNode;
  if (status === "warning")
    content = (
      <>
        <Header
          title={translate("simulationWarning")}
          titleIcon={WarningIcon}
          variant="warning"
        />
        <Formik onSubmit={handleOpenReport} initialValues={{}}>
          <Form>
            <p className="text-sm text-gray">
              {translate("simulationWarningExplain")}
            </p>
            <SimpleDialogActions
              autoFocusSubmit={true}
              secondary={{
                action: modal.ignoreLabel || translate("ignore"),
                onClick: handleIgnore,
              }}
              action={translate("viewReport")}
            />
          </Form>
        </Formik>
      </>
    );
  else if (status === "failure")
    content = (
      <>
        <Header
          title={translate("simulationFailure")}
          titleIcon={ErrorIcon}
          variant="danger"
        />
        <Formik onSubmit={handleOpenReport} initialValues={{}}>
          <Form>
            <p className="text-sm text-gray">
              {translate("simulationFailureExplain")}
            </p>
            <SimpleDialogActions
              autoFocusSubmit={true}
              secondary={{
                action: modal.ignoreLabel || translate("ignore"),
                onClick: handleIgnore,
              }}
              action={translate("viewReport")}
            />
          </Form>
        </Formik>
      </>
    );
  else if (status === "success")
    content = (
      <>
        <Header
          title={translate("simulationSuccess")}
          titleIcon={SuccessIcon}
          variant="success"
        />
        <Formik onSubmit={() => onClose()} initialValues={{}}>
          <Form>
            <p className="text-sm text-gray">
              {translate("simulationTook", ((duration || 0) / 1000).toFixed(2))}
            </p>
            <SimpleDialogActions
              autoFocusSubmit={true}
              secondary={{
                action: translate("viewReport"),
                onClick: handleOpenReport,
              }}
              action={translate("ok")}
            />
          </Form>
        </Formik>
      </>
    );
  else content = <Loading />;

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Trigger className="hidden">
        <div className="hidden" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <StyledDialogOverlay />
        <Dialog.Title></Dialog.Title>
        <Dialog.Description></Dialog.Description>
        <ContentShell
          size="sm"
          onEscapeKeyDown={() => onClose()}
          onInteractOutside={() => onClose()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DefaultErrorBoundary>{content}</DefaultErrorBoundary>
        </ContentShell>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
