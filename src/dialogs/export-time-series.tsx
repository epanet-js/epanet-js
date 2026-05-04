import { useState, useRef, useEffect } from "react";
import { useAtomValue } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { Export } from "src/lib/export";
import type { ExportTimeSeriesMetrics } from "src/lib/export/types";

const SIZE_WARNING_LIMIT_GB = 1;

type NodeFields = {
  pressure: boolean;
  head: boolean;
  demand: boolean;
  waterQuality: boolean;
};

type LinkFields = {
  status: boolean;
  flow: boolean;
  velocity: boolean;
  unitHeadloss: boolean;
};

const IndeterminateCheckbox = ({
  checked,
  indeterminate,
  onChange,
  className,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
    />
  );
};

export const ExportTimeSeriesDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();

  const selection = useAtomValue(selectionAtom);
  const selectedIds = USelection.toIds(selection);
  const hasSelection = selectedIds.length > 0;

  const model = useAtomValue(stagingModelAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
  const timestepCount = epsResultsReader?.timestepCount ?? 0;

  const [selectedAssetsOnly, setSelectedAssetsOnly] = useState(false);
  const [nodeFields, setNodeFields] = useState<NodeFields>({
    pressure: true,
    head: true,
    demand: true,
    waterQuality: true,
  });
  const [linkFields, setLinkFields] = useState<LinkFields>({
    status: true,
    flow: true,
    velocity: true,
    unitHeadloss: true,
  });

  const nodeCheckedCount = Object.values(nodeFields).filter(Boolean).length;
  const nodeTotal = Object.keys(nodeFields).length;
  const nodeAllChecked = nodeCheckedCount === nodeTotal;
  const nodeIndeterminate = nodeCheckedCount > 0 && !nodeAllChecked;

  const linkCheckedCount = Object.values(linkFields).filter(Boolean).length;
  const linkTotal = Object.keys(linkFields).length;
  const linkAllChecked = linkCheckedCount === linkTotal;
  const linkIndeterminate = linkCheckedCount > 0 && !linkAllChecked;

  const toggleAllNodes = () => {
    const next = !nodeAllChecked;
    setNodeFields({
      pressure: next,
      head: next,
      demand: next,
      waterQuality: next,
    });
  };

  const toggleAllLinks = () => {
    const next = !linkAllChecked;
    setLinkFields({
      status: next,
      flow: next,
      velocity: next,
      unitHeadloss: next,
    });
  };

  const getNodeCount = () => {
    if (selectedAssetsOnly) {
      return selectedIds.filter((id) => model.assets.get(id)?.isNode).length;
    }
    return model.assetIndex.nodeCount;
  };
  const getLinkCount = () => {
    if (selectedAssetsOnly) {
      return selectedIds.filter((id) => model.assets.get(id)?.isLink).length;
    }
    return model.assetIndex.linkCount;
  };

  const selectedNodeMetrics = (
    Object.entries(nodeFields) as [keyof NodeFields, boolean][]
  )
    .filter(([, checked]) => checked)
    .map(([key]) => key as ExportTimeSeriesMetrics);
  const selectedLinkMetrics = (
    Object.entries(linkFields) as [keyof LinkFields, boolean][]
  )
    .filter(([, checked]) => checked)
    .map(([key]) => key as ExportTimeSeriesMetrics);

  const estimatedBytes =
    Export.estimateTimeSeriesSize(
      selectedNodeMetrics,
      getNodeCount(),
      timestepCount,
    ) +
    Export.estimateTimeSeriesSize(
      selectedLinkMetrics,
      getLinkCount(),
      timestepCount,
    );
  const estimatedGB = estimatedBytes / 1024 ** 3;
  const showSizeWarning = estimatedGB >= SIZE_WARNING_LIMIT_GB;

  return (
    <BaseDialog
      title={translate("exportTimeSeries")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("export")}
          onAction={onClose}
          secondary={{
            action: translate("dialog.cancel"),
            onClick: onClose,
          }}
        />
      }
    >
      <div className="p-4 space-y-4">
        <label
          className={`flex items-center gap-x-2 ${hasSelection ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
        >
          <input
            type="checkbox"
            checked={selectedAssetsOnly}
            disabled={!hasSelection}
            onChange={(e) => setSelectedAssetsOnly(e.target.checked)}
            className="rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50"
          />
          <span className="text-sm text-gray-700">
            {translate("exportSelectedAssetsOnly")}
          </span>
        </label>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
          <div className="space-y-2">
            <label className="flex items-center gap-x-2 cursor-pointer">
              <IndeterminateCheckbox
                checked={nodeAllChecked}
                indeterminate={nodeIndeterminate}
                onChange={toggleAllNodes}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900">
                {translate("nodes")}
              </span>
            </label>
            <div className="pl-5 space-y-2">
              {(
                [
                  ["pressure", "pressure"],
                  ["head", "head"],
                  ["demand", "demand"],
                  ["waterQuality", "simulationSettings.waterQuality"],
                ] as [keyof NodeFields, string][]
              ).map(([key, translationKey]) => (
                <label
                  key={key}
                  className="flex items-center gap-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={nodeFields[key]}
                    onChange={(e) =>
                      setNodeFields((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">
                    {translate(translationKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-x-2 cursor-pointer">
              <IndeterminateCheckbox
                checked={linkAllChecked}
                indeterminate={linkIndeterminate}
                onChange={toggleAllLinks}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900">
                {translate("links")}
              </span>
            </label>
            <div className="pl-5 space-y-2">
              {(
                [
                  ["status", "status"],
                  ["flow", "flow"],
                  ["velocity", "velocity"],
                  ["unitHeadloss", "unitHeadloss"],
                ] as [keyof LinkFields, string][]
              ).map(([key, translationKey]) => (
                <label
                  key={key}
                  className="flex items-center gap-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={linkFields[key]}
                    onChange={(e) =>
                      setLinkFields((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">
                    {translate(translationKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {showSizeWarning && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md space-y-1">
            <p className="text-sm font-medium text-yellow-800">
              {translate(
                "exportTimeSeries.largeExportTitle",
                estimatedGB.toFixed(1),
              )}
            </p>
            <p className="text-sm text-yellow-800">
              {translate("exportTimeSeries.largeExportDescription")}
            </p>
          </div>
        )}
      </div>
    </BaseDialog>
  );
};
