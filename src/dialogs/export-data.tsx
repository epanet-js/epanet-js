import { useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useExportData } from "src/commands/export-data";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { simulationStepAtom } from "src/state/simulation";
import { dialogAtom } from "src/state/dialog";
import type { ExportFormat } from "src/lib/export/types";

const exportFormats: { value: ExportFormat; labelKey: string }[] = [
  { value: "geojson", labelKey: "exportGeojson" },
  { value: "shapefile", labelKey: "exportShapefile" },
  { value: "csv", labelKey: "exportCsv" },
];

export const ExportDataDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const exportData = useExportData();
  const setDialogState = useSetAtom(dialogAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const currentSimulationStep = useAtomValue(simulationStepAtom);
  const hasSimulationResults =
    simulation.status === "success" || simulation.status === "warning";

  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
  const timestepCount = epsResultsReader?.timestepCount ?? 0;
  const reportingTimeStep = epsResultsReader?.reportingTimeStep ?? 3600;

  const [format, setFormat] = useState<ExportFormat>("geojson");
  const [includeSimulationResults, setIncludeSimulationResults] =
    useState(false);
  const [exportAllResultsAsCsv, setExportAllResultsAsCsv] = useState(false);
  const [selectedTimestep, setSelectedTimestep] = useState<number>(
    currentSimulationStep ?? 0,
  );

  const handleExport = useCallback(async () => {
    setDialogState(null);
    await exportData({
      format,
      includeSimulationResults,
      simulationStep: includeSimulationResults ? selectedTimestep : undefined,
      exportAllResultsAsCsv,
    });
  }, [
    exportData,
    exportAllResultsAsCsv,
    format,
    includeSimulationResults,
    selectedTimestep,
    setDialogState,
  ]);

  const showTimestepSelector =
    includeSimulationResults && hasSimulationResults && timestepCount > 1;

  return (
    <BaseDialog
      title={translate("exportData")}
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
              {translate("includeSimulationResults")}
            </span>
          </label>

          {showTimestepSelector && (
            <div className="space-y-2 pl-6">
              <select
                value={exportAllResultsAsCsv ? "all" : "single"}
                onChange={(e) =>
                  setExportAllResultsAsCsv(e.target.value === "all")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="single">
                  {translate("exportSingleTimestep")}
                </option>
                <option value="all">{translate("exportAllTimesteps")}</option>
              </select>

              {!exportAllResultsAsCsv && (
                <select
                  value={selectedTimestep}
                  onChange={(e) => setSelectedTimestep(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {Array.from({ length: timestepCount }, (_, i) => (
                    <option key={i} value={i}>
                      {formatTimestepTime(i, reportingTimeStep)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
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
