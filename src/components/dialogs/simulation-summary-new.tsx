import { useShowReport } from "src/commands/show-report";
import { SimulationSummaryState } from "src/state/dialog";
import { BaseModal, SimpleDialogActionsNew } from "../dialog";
import { Loading } from "../elements";
import { useTranslate } from "src/hooks/use-translate";
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

  const isSuccess = modal.status === "success";
  const config = {
    success: {
      variant: "success",
      title: translate("simulationSuccess"),
      iconClass: "text-green-500",
    },
    warning: {
      variant: "warning",
      title: translate("simulationWarning"),
      iconClass: "text-yellow-500",
    },
    failure: {
      variant: "danger",
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
      onSubmit={handleAction}
      size="xs"
      footer={
        <SimpleDialogActionsNew
          autoFocusSubmit={true}
          action={isSuccess ? translate("ok") : translate("viewReport")}
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
