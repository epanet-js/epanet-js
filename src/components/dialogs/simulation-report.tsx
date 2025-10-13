import { useTranslate } from "src/hooks/use-translate";
import { DialogContainer, DialogHeader } from "../dialog";
import { processReportWithSlots, ReportRow } from "src/simulation/report";
import { useMemo, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  dataAtom,
  simulationAtom,
  selectionAtom,
  dialogAtom,
} from "src/state/jotai";
import { FileTextIcon } from "src/icons";
import { useSelection } from "src/selection/use-selection";
import { AssetId } from "src/hydraulic-model";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError, setErrorContext } from "src/infra/error-tracking";

export const SimulationReportDialog = () => {
  const translate = useTranslate();
  const simulation = useAtomValue(simulationAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const selection = useAtomValue(selectionAtom);
  const { selectFeature } = useSelection(selection);
  const setDialog = useSetAtom(dialogAtom);
  const zoomTo = useZoomTo();
  const userTracking = useUserTracking();

  const handleAssetClick = useCallback(
    (assetId: AssetId) => {
      const asset = hydraulicModel.assets.get(assetId);
      if (asset) {
        selectFeature(assetId);
        zoomTo([asset]);
        setDialog(null);
      }
      userTracking.capture({
        name: "simulationReport.assetClicked",
        assetType: asset ? asset.type : null,
      });
    },
    [selectFeature, setDialog, hydraulicModel.assets, zoomTo, userTracking],
  );

  const renderRowWithSlots = useCallback(
    (reportRow: ReportRow, index: number) => {
      const trimmedText = reportRow.text.slice(2);
      const finalText = trimmedText.startsWith("  Error")
        ? trimmedText.slice(2)
        : trimmedText;

      if (reportRow.assetSlots.length === 0) {
        return <pre key={index}>{finalText}</pre>;
      }

      const parts = [];
      const textParts = finalText.split(/(\{\{\d+\}\})/);
      let slotIndex = 0;

      for (const part of textParts) {
        const slotMatch = part.match(/^\{\{(\d+)\}\}$/);
        if (slotMatch) {
          const slotNumber = parseInt(slotMatch[1], 10);
          const assetId = reportRow.assetSlots[slotNumber];
          const asset = hydraulicModel.assets.get(assetId);

          if (asset) {
            parts.push(
              <span
                key={`${index}-slot-${slotIndex}`}
                className="text-purple-600 underline cursor-pointer hover:text-purple-700 hover:bg-purple-50 px-1 rounded"
                onClick={() => handleAssetClick(assetId)}
              >
                {asset.label}
              </span>,
            );
          } else {
            parts.push(part);
          }
          slotIndex++;
        } else {
          parts.push(part);
        }
      }

      return <pre key={index}>{parts}</pre>;
    },
    [hydraulicModel.assets, handleAssetClick],
  );

  const processedReport = useMemo(() => {
    if (
      simulation.status !== "success" &&
      simulation.status !== "failure" &&
      simulation.status !== "warning"
    )
      return [];

    const { processedReport, errorCollector } = processReportWithSlots(
      simulation.report,
      hydraulicModel.assets,
    );

    if (errorCollector.hasErrors()) {
      const errors = errorCollector.getErrors();
      setErrorContext("Report Processing Issues", {
        issues: errors.map((e) => JSON.stringify(e)),
      });

      const errorMessage = `Report processing encountered ${errors.length} lines with issues`;
      captureError(new Error(errorMessage));
    }

    return processedReport;
  }, [simulation, hydraulicModel.assets]);

  return (
    <DialogContainer size="lg" fillMode="auto">
      <DialogHeader
        title={translate("simulationReport")}
        titleIcon={FileTextIcon}
      />

      <div className="p-4 overflow-auto border rounded-sm text-sm bg-gray-100 text-gray-700 font-mono leading-loose">
        {processedReport.map(renderRowWithSlots)}
      </div>
    </DialogContainer>
  );
};
