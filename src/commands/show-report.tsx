import { FileTextIcon } from "@radix-ui/react-icons";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { dialogAtom } from "src/state/dialog_state";
import { simulationAtom } from "src/state/jotai";

export const useShowReport = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const showReport = useCallback(() => {
    setDialogState({ type: "simulationReport" });
  }, [setDialogState]);

  return showReport;
};

export const SimulationReportDialog = ({}: { onClose: () => void }) => {
  const simulation = useAtomValue(simulationAtom);

  const formattedReport = useMemo(() => {
    if (simulation.status !== "success" && simulation.status !== "failure")
      return "";

    const rows = simulation.report.split("\n");
    return rows.map((row, i) => {
      const trimmedRow = row.slice(2);
      return (
        <pre key={i}>
          {trimmedRow.startsWith("  Error") ? trimmedRow.slice(2) : trimmedRow}
        </pre>
      );
    });
  }, [simulation]);

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
