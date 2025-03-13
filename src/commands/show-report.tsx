import { FileTextIcon } from "@radix-ui/react-icons";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { useUserTracking } from "src/infra/user-tracking";
import { replaceIdWithLabels } from "src/simulation/report";
import { dialogAtom } from "src/state/dialog_state";
import { dataAtom, simulationAtom } from "src/state/jotai";

export const showReportShorcut = "alt+r";

export const useShowReport = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const simulation = useAtomValue(simulationAtom);

  const showReport = useCallback(
    ({ source }: { source: "toolbar" | "resultDialog" | "shortcut" }) => {
      userTracking.capture({
        name: "report.opened",
        source,
        status: simulation.status,
      });
      setDialogState({ type: "simulationReport" });
    },
    [setDialogState, userTracking, simulation],
  );

  return showReport;
};

export const SimulationReportDialog = ({}: { onClose: () => void }) => {
  const simulation = useAtomValue(simulationAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);

  const formattedReport = useMemo(() => {
    if (simulation.status !== "success" && simulation.status !== "failure")
      return "";

    const reportWithLabels = replaceIdWithLabels(
      simulation.report,
      hydraulicModel.assets,
    );
    const rows = reportWithLabels.split("\n");
    return rows.map((row, i) => {
      const trimmedRow = row.slice(2);
      return (
        <pre key={i}>
          {trimmedRow.startsWith("  Error") ? trimmedRow.slice(2) : trimmedRow}
        </pre>
      );
    });
  }, [simulation, hydraulicModel]);

  return (
    <>
      <DialogHeader
        title={translate("simulationReport")}
        titleIcon={FileTextIcon}
      />

      <div className="p-4 border rounded-sm text-sm bg-gray-100 text-gray-700 font-mono leading-loose">
        {formattedReport}
      </div>
    </>
  );
};
