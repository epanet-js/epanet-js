import { useShowReport } from "src/commands/show-report";
import { SimulationSummaryState } from "src/state/dialog";
import {
  BaseModal,
  DialogContainer,
  DialogHeader,
  LoadingDialog,
  SimpleDialogActions,
  SimpleDialogActionsNew,
} from "../dialog";
import { Loading } from "../elements";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

import { Form, Formik } from "formik";
import { ErrorIcon, SuccessIcon, WarningIcon } from "src/icons";

export const SimulationSummaryDialog = ({
  modal,
  onClose,
}: {
  modal: SimulationSummaryState;
  onClose: () => void;
}) => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const translate = useTranslate();
  const showReport = useShowReport();

  if (isModalsOn)
    return <SimulationSummaryDialogNew modal={modal} onClose={onClose} />;

  const handleOpenReport = () => {
    showReport({ source: "resultDialog" });
  };
  const { status, duration } = modal;
  const handleIgnore = () => {
    onClose();
    (modal.onIgnore ?? modal.onContinue)?.();
  };

  if (status === "warning")
    return (
      <DialogContainer size="sm">
        <DialogHeader
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
      </DialogContainer>
    );
  if (status === "failure")
    return (
      <DialogContainer size="sm">
        <DialogHeader
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
      </DialogContainer>
    );
  if (status === "success")
    return (
      <DialogContainer size="sm">
        <DialogHeader
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
      </DialogContainer>
    );

  return <LoadingDialog />;
};

const SimulationSummaryDialogNew = ({
  modal,
  onClose,
}: {
  modal: SimulationSummaryState;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showReport = useShowReport();

  const isSuccess = modal.status === "success";
  const config = {
    success: {
      title: translate("simulationSuccess"),
      iconClass: "text-green-500",
    },
    warning: {
      title: translate("simulationWarning"),
      iconClass: "text-yellow-500",
    },
    failure: {
      title: translate("simulationFailure"),
      iconClass: "text-red-500",
    },
  }[modal.status];

  if (!config) return <Loading />;

  const handleAction = () => {
    if (isSuccess) onClose();
    else showReport({ source: "resultDialog" });
  };

  const handleSecondary = () => {
    if (isSuccess) showReport({ source: "resultDialog" });
    else {
      onClose();
      (modal.onIgnore ?? modal.onContinue)?.();
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={config.title}
      size="xs"
      footer={
        <SimpleDialogActionsNew
          autoFocusSubmit={true}
          action={isSuccess ? translate("ok") : translate("viewReport")}
          onAction={handleAction}
          secondary={{
            action: isSuccess
              ? translate("viewReport")
              : modal.ignoreLabel || translate("ignore"),
            onClick: handleSecondary,
          }}
        />
      }
    >
      <div className="p-4 text-sm text-gray-700">
        <p className="flex items-start gap-2">
          <div className={`m-width-0 mt-0.5 ${config.iconClass}`}>
            {modal.status === "success" && <SuccessIcon />}
            {modal.status === "warning" && <WarningIcon />}
            {modal.status === "failure" && <ErrorIcon />}
          </div>
          {isSuccess
            ? translate(
                "simulationTook",
                ((modal.duration || 0) / 1000).toFixed(2),
              )
            : translate(
                modal.status === "warning"
                  ? "simulationWarningExplain"
                  : "simulationFailureExplain",
              )}
        </p>
      </div>
    </BaseModal>
  );
};
