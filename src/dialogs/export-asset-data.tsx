import { useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useExportAssetData } from "src/commands/export-asset-data";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { simulationStepAtom } from "src/state/simulation";
import { dialogAtom } from "src/state/dialog";
import type { ExportFormat } from "src/lib/export/types";

const exportFormats: { value: ExportFormat; labelKey: string }[] = [
  { value: "geojson", labelKey: "exportGeojson" },
  { value: "csv", labelKey: "exportCsv" },
];

export const ExportAssetDataDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const exportAssetData = useExportAssetData();
  const setDialogState = useSetAtom(dialogAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const simulationStep = useAtomValue(simulationStepAtom) ?? 0;
  const hasSimulationResults =
    simulation.status === "success" || simulation.status === "warning";

  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
  const timestepCount = epsResultsReader?.timestepCount ?? 0;
  const reportingTimeStep = epsResultsReader?.reportingTimeStep ?? 3600;

  const [format, setFormat] = useState<ExportFormat>("geojson");
  const [includeSimulationResults, setIncludeSimulationResults] =
    useState(false);

  const handleExport = useCallback(async () => {
    setDialogState(null);
    await exportAssetData({
      format,
      includeSimulationResults,
      simulationStep,
    });
  }, [
    exportAssetData,
    format,
    includeSimulationResults,
    simulationStep,
    setDialogState,
  ]);

  const isEpsSimulation = timestepCount > 1;
  const includeSimulationResultsLabelText = isEpsSimulation
    ? `${translate("exportSimulationResultsForCurrentStep")} ${formatTimestepTime(simulationStep ?? 0, reportingTimeStep)}`
    : translate("exportSimulationResults");

  return (
    <BaseDialog
      title={translate("exportAssetData")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("export")}
          onAction={handleExport}
          secondary={{
            action: translate("dialog.cancel"),
            onClick: onClose,
          }}
        />
      }
    >
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {translate("exportFormat")}
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {exportFormats.map(({ value, labelKey }) => (
              <option key={value} value={value}>
                {translate(labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-gray-200 pt-4 space-y-3">
          <label
            className={`flex items-center gap-x-2 ${hasSimulationResults ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
          >
            <input
              type="checkbox"
              checked={includeSimulationResults}
              disabled={!hasSimulationResults}
              onChange={(e) => setIncludeSimulationResults(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700">
              {includeSimulationResultsLabelText}
            </span>
          </label>
        </div>
      </div>
    </BaseDialog>
  );
};

function formatTimestepTime(timestepIndex: number, intervalSeconds = 3600) {
  const totalSeconds = timestepIndex * intervalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
