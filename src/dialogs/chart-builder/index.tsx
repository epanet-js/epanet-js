import { useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { selectionAtom } from "src/state/selection";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { classifyAssetTypes, getAvailableProperties } from "./property-config";
import type { AssetType } from "src/hydraulic-model/asset-types";
import type { QuickGraphAssetType } from "src/state/quick-graph";
import { ChartStep } from "./steps/chart-step";

type ChartType = "line" | "variability";
type AssetGroup = "nodes" | "links" | "all";

interface ChartBuilderDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChartBuilderWizard({
  isOpen,
  onClose,
}: ChartBuilderDialogProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);

  const selectedAssetIds = useMemo(() => {
    if (selection.type === "single") return [selection.id];
    if (selection.type === "multi") return [...selection.ids];
    return [];
  }, [selection]);

  const assetTypes = useMemo(
    () =>
      selectedAssetIds.flatMap((id) => {
        const asset = hydraulicModel.assets.get(id);
        return asset ? [asset.type as AssetType] : [];
      }),
    [selectedAssetIds, hydraulicModel.assets],
  );

  const classification = useMemo(
    () => classifyAssetTypes(assetTypes),
    [assetTypes],
  );

  const isMixed = classification.hasNodes && classification.hasLinks;

  const qualityType = useMemo(() => {
    if ("epsResultsReader" in simulation && simulation.epsResultsReader) {
      return simulation.epsResultsReader.qualityType;
    }
    return null;
  }, [simulation]);

  const nodeOptions = useMemo(() => {
    const types = classification.nodeTypes as QuickGraphAssetType[];
    return getAvailableProperties(types, qualityType).map((p) => {
      const label = translate(p.labelKey);
      const unit = units[p.quantityKey as keyof typeof units];
      return {
        value: p.value,
        label: unit ? `${label} (${translateUnit(unit)})` : label,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classification.nodeTypes, qualityType, units]);

  const linkOptions = useMemo(() => {
    const types = classification.linkTypes as QuickGraphAssetType[];
    return getAvailableProperties(types, qualityType).map((p) => {
      const label = translate(p.labelKey);
      const unit = units[p.quantityKey as keyof typeof units];
      return {
        value: p.value,
        label: unit ? `${label} (${translateUnit(unit)})` : label,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classification.linkTypes, qualityType, units]);

  const [nodeProperty, setNodeProperty] = useState<string | null>(
    nodeOptions[0]?.value ?? null,
  );
  const [linkProperty, setLinkProperty] = useState<string | null>(
    linkOptions[0]?.value ?? null,
  );

  const isMultiple = selectedAssetIds.length >= 2;
  const [chartType, setChartType] = useState<ChartType>(
    isMultiple ? "variability" : "line",
  );
  const [assetGroup, setAssetGroup] = useState<AssetGroup>(
    isMultiple ? "nodes" : "all",
  );

  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type);
    if (type === "line") setAssetGroup("all");
    else if (assetGroup === "all") setAssetGroup("nodes");
  };

  const selectorStyle = {
    border: true,
    textSize: "text-sm" as const,
    paddingY: 1,
  };

  return (
    <BaseDialog
      title={translate("chartBuilder.selectionTitle")}
      size="xl"
      height="xl"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <footer className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <Button type="button" variant="default" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="default" onClick={() => {}}>
              Save as PNG
            </Button>
            <Button type="button" variant="default" onClick={() => {}}>
              Export CSV
            </Button>
          </div>
        </footer>
      }
    >
      <div className="flex flex-col flex-1 min-h-0">
        {selectedAssetIds.length === 0 ? (
          <p className="text-sm text-gray-700 px-4">
            {translate("chartBuilder.noAssets")}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-4">
                {classification.hasNodes && nodeOptions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {isMixed && (
                      <span className="text-sm text-gray-500 shrink-0">
                        Nodes
                      </span>
                    )}
                    <Selector
                      options={nodeOptions}
                      selected={nodeProperty ?? nodeOptions[0]?.value ?? ""}
                      onChange={setNodeProperty}
                      styleOptions={selectorStyle}
                    />
                  </div>
                )}
                {classification.hasLinks && linkOptions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {isMixed && (
                      <span className="text-sm text-gray-500 shrink-0">
                        Links
                      </span>
                    )}
                    <Selector
                      options={linkOptions}
                      selected={linkProperty ?? linkOptions[0]?.value ?? ""}
                      onChange={setLinkProperty}
                      styleOptions={selectorStyle}
                    />
                  </div>
                )}
              </div>
              {isMultiple && (
                <div className="flex gap-2">
                  <ChartTypeToggle
                    value={chartType}
                    onChange={handleChartTypeChange}
                  />
                  {isMixed && (
                    <AssetGroupToggle
                      value={assetGroup}
                      onChange={setAssetGroup}
                      allDisabled={chartType === "variability"}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col flex-1 min-h-0 px-4 py-3">
              <ChartStep
                selectedAssetIds={selectedAssetIds}
                nodeProperty={nodeProperty}
                linkProperty={linkProperty}
                chartType={chartType}
                assetGroup={assetGroup}
              />
            </div>
          </>
        )}
      </div>
    </BaseDialog>
  );
}

function ChartTypeToggle({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (v: ChartType) => void;
}) {
  return (
    <SegmentedToggle
      options={[
        { value: "variability", label: "Variability" },
        { value: "line", label: "Line" },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function AssetGroupToggle({
  value,
  onChange,
  allDisabled,
}: {
  value: AssetGroup;
  onChange: (v: AssetGroup) => void;
  allDisabled: boolean;
}) {
  return (
    <SegmentedToggle
      options={[
        { value: "nodes", label: "Nodes" },
        { value: "links", label: "Links" },
        { value: "all", label: "All", disabled: allDisabled },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded border border-gray-200 overflow-hidden text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-3 py-1 transition-colors",
            opt.disabled
              ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
              : value === opt.value
                ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white font-medium"
                : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
