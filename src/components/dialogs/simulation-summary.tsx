import { useShowReport } from "src/commands/show-report";
import { SimulationSummaryState } from "src/state/dialog";
import {
  DialogContainer,
  DialogHeader,
  LoadingDialog,
  SimpleDialogActions,
} from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { Form, Formik } from "formik";

export const SimulationSummaryDialog = ({
  modal,
  onClose,
}: {
  modal: SimulationSummaryState;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showReport = useShowReport();

  const handleOpenReport = () => {
    showReport({ source: "resultDialog" });
  };

  const { status, duration } = modal;
  if (status === "warning")
    return (
      <DialogContainer size="sm">
        <DialogHeader
          title={translate("simulationWarning")}
          titleIcon={ExclamationTriangleIcon}
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
                action: translate("ignore"),
                onClick: onClose,
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
          titleIcon={CrossCircledIcon}
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
                action: translate("ignore"),
                onClick: onClose,
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
          titleIcon={CheckCircledIcon}
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
