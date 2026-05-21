import { useState, useMemo } from "react";
import { useAtomValue } from "jotai";
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

type DisplayType =
  | "line"
  | "variability"
  | "variability-nodes"
  | "variability-links";

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

  const combinedOptions = useMemo(
    () => [
      ...nodeOptions.map((o) => ({ value: `node:${o.value}`, label: o.label })),
      ...linkOptions.map((o) => ({ value: `link:${o.value}`, label: o.label })),
    ],
    [nodeOptions, linkOptions],
  );

  const [combinedProperty, setCombinedProperty] = useState<string | null>(
    combinedOptions[0]?.value ?? null,
  );

  const isMultiple = selectedAssetIds.length >= 2;

  const initialDisplayType: DisplayType = !isMultiple
    ? "line"
    : isMixed
      ? "variability-nodes"
      : "variability";

  const [displayType, setDisplayType] =
    useState<DisplayType>(initialDisplayType);

  const displayTypeOptions = useMemo(
    () =>
      isMixed
        ? [
            { value: "line", label: "Line" },
            { value: "variability-nodes", label: "Variability — Nodes" },
            { value: "variability-links", label: "Variability — Links" },
          ]
        : [
            { value: "line", label: "Line" },
            { value: "variability", label: "Variability" },
          ],
    [isMixed],
  );

  const chartType = displayType === "line" ? "line" : "variability";
  const assetGroup =
    displayType === "variability-nodes"
      ? "nodes"
      : displayType === "variability-links"
        ? "links"
        : "all";

  const isVariabilityMixed = isMixed && displayType !== "line";

  const effectiveNodeProperty = isVariabilityMixed
    ? combinedProperty?.startsWith("node:")
      ? combinedProperty.slice(5)
      : null
    : nodeProperty;

  const effectiveLinkProperty = isVariabilityMixed
    ? combinedProperty?.startsWith("link:")
      ? combinedProperty.slice(5)
      : null
    : linkProperty;

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
        <footer className="flex items-center justify-end px-4 py-3 border-t border-gray-200">
          <Button type="button" variant="default" onClick={onClose}>
            Close
          </Button>
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
              <div className="flex items-center gap-2">
                {isVariabilityMixed ? (
                  <Selector
                    options={combinedOptions}
                    selected={
                      combinedProperty ?? combinedOptions[0]?.value ?? ""
                    }
                    onChange={setCombinedProperty}
                    styleOptions={selectorStyle}
                  />
                ) : (
                  <>
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
                  </>
                )}
                {isMultiple && (
                  <Selector
                    options={displayTypeOptions}
                    selected={displayType}
                    onChange={(v) => setDisplayType(v as DisplayType)}
                    styleOptions={selectorStyle}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="default" onClick={() => {}}>
                  Save as PNG
                </Button>
                <Button type="button" variant="default" onClick={() => {}}>
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 px-4 py-3">
              <ChartStep
                selectedAssetIds={selectedAssetIds}
                nodeProperty={effectiveNodeProperty}
                linkProperty={effectiveLinkProperty}
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
