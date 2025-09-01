import { useTranslate } from "src/hooks/use-translate";
import { DialogContainer, DialogHeader } from "../dialog";
import { FileTextIcon } from "@radix-ui/react-icons";
import { replaceIdWithLabels } from "src/simulation/report";
import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { FileText } from "lucide-react";

export const SimulationReportDialog = () => {
  const translate = useTranslate();
  const simulation = useAtomValue(simulationAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);

  const formattedReport = useMemo(() => {
    if (
      simulation.status !== "success" &&
      simulation.status !== "failure" &&
      simulation.status !== "warning"
    )
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
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");
  return (
    <DialogContainer size="lg" fillMode="auto">
      <DialogHeader
        title={translate("simulationReport")}
        titleIcon={isLucideIconsOn ? FileText : FileTextIcon}
      />

      <div className="p-4 overflow-auto border rounded-sm text-sm bg-gray-100 text-gray-700 font-mono leading-loose">
        {formattedReport}
      </div>
    </DialogContainer>
  );
};
