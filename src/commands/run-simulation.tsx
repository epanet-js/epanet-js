import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { dataAtom, dialogAtom, simulationAtom } from "src/state/jotai";
import { runSimulation as run } from "src/simulation";
import { attachSimulation } from "src/hydraulic-model";
import { Loading } from "src/components/elements";
import { SimulationSummaryState } from "src/state/dialog_state";
import { translate } from "src/infra/i18n";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import SimpleDialogActions from "src/components/dialogs/simple_dialog_actions";
import { Form, Formik } from "formik";
import { useShowReport } from "./show-report";
import { isFeatureOn } from "src/infra/feature-flags";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);

  const runSimulation = useCallback(async () => {
    setSimulationState({ status: "running" });
    const inp = buildInp(hydraulicModel);
    const start = performance.now();
    setDialogState({ type: "loading" });
    const { report, status, results } = await run(inp, {
      FLAG_VALVE: isFeatureOn("FLAG_VALVE"),
    });

    attachSimulation(hydraulicModel, results);
    setData((prev) => ({
      ...prev,
      hydraulicModel,
    }));

    setSimulationState({
      status,
      report,
      modelVersion: hydraulicModel.version,
    });
    const end = performance.now();
    const duration = end - start;
    setDialogState({
      type: "simulationSummary",
      status,
      duration,
    });
  }, [hydraulicModel, setSimulationState, setData, setDialogState]);

  return runSimulation;
};

export const RunSimulationDialog = ({
  modal,
  onClose,
}: {
  modal: SimulationSummaryState;
  onClose: () => void;
}) => {
  const showReport = useShowReport();

  const handleOpenReport = () => {
    showReport({ source: "resultDialog" });
  };

  const { status, duration } = modal;
  if (status === "warning")
    return (
      <>
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
      </>
    );
  if (status === "failure")
    return (
      <>
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
      </>
    );
  if (status === "success")
    return (
      <>
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
      </>
    );

  return <Loading />;
};
