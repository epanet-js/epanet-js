import { useState, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PinIcon, PinOffIcon } from "src/icons";
import { Button } from "src/components/elements";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import {
  assetPanelFooterAtom,
  DEFAULT_FOOTER_HEIGHT,
} from "src/state/quick-graph";
import {
  classifyAssetTypes,
  getAvailableProperties,
} from "src/dialogs/chart-builder/property-config";
import type { AssetType } from "src/hydraulic-model/asset-types";
import type { QuickGraphAssetType } from "src/state/quick-graph";
import { ChartStep } from "src/dialogs/chart-builder/steps/chart-step";
import { useShowQuickGraph } from "src/panels/asset-panel/quick-graph/quick-graph-section";

const VARIABILITY_THRESHOLD = 12;

const selectorStyle = {
  border: true as const,
  textSize: "text-sm" as const,
  paddingY: 1,
};

interface MultiQuickGraphSectionProps {
  selectedAssetIds: number[];
}

const MultiQuickGraphSection = ({
  selectedAssetIds,
}: MultiQuickGraphSectionProps) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const [footerState, setFooterState] = useAtom(assetPanelFooterAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);

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
  }, [classification.nodeTypes, qualityType, units, translate, translateUnit]);

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
  }, [classification.linkTypes, qualityType, units, translate, translateUnit]);

  const [nodeProperty, setNodeProperty] = useState<string | null>(
    nodeOptions[0]?.value ?? null,
  );
  const [linkProperty, setLinkProperty] = useState<string | null>(
    linkOptions[0]?.value ?? null,
  );

  const isMixed = classification.hasNodes && classification.hasLinks;

  const chartType =
    selectedAssetIds.length > VARIABILITY_THRESHOLD ? "variability" : "line";

  const isVariabilityMixed = chartType === "variability" && isMixed;

  const combinedOptions = useMemo(() => {
    if (!isVariabilityMixed) return [];
    return [
      ...nodeOptions.map((o) => ({ value: `node:${o.value}`, label: o.label })),
      ...linkOptions.map((o) => ({ value: `link:${o.value}`, label: o.label })),
    ];
  }, [isVariabilityMixed, nodeOptions, linkOptions]);

  const [combinedProperty, setCombinedProperty] = useState<string | null>(
    combinedOptions[0]?.value ?? null,
  );

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

  const assetGroup = isVariabilityMixed
    ? combinedProperty?.startsWith("link:")
      ? "links"
      : "nodes"
    : "all";

  const handlePinToggle = () => {
    setFooterState((prev) => ({
      isPinned: !prev.isPinned,
      height: DEFAULT_FOOTER_HEIGHT,
    }));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 pl-5">
      <div className="flex items-center justify-between text-sm font-semibold h-8">
        {translate("quickGraph")}
        <div className="flex h-8 my-[-0.5rem]">
          <Button
            variant="quiet"
            onClick={handlePinToggle}
            title={footerState.isPinned ? translate("unpin") : translate("pin")}
            aria-label={
              footerState.isPinned ? translate("unpin") : translate("pin")
            }
            data-state-on={footerState.isPinned || undefined}
          >
            {footerState.isPinned ? <PinOffIcon /> : <PinIcon />}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 pb-2 w-max">
        {isVariabilityMixed ? (
          combinedOptions.length > 1 ? (
            <Selector
              options={combinedOptions}
              selected={combinedProperty ?? combinedOptions[0]?.value ?? ""}
              onChange={setCombinedProperty}
              styleOptions={selectorStyle}
            />
          ) : (
            <span className="text-sm text-gray-700 py-1">
              {combinedOptions[0]?.label}
            </span>
          )
        ) : (
          <>
            {classification.hasNodes &&
              nodeOptions.length > 0 &&
              (nodeOptions.length > 1 ? (
                <Selector
                  options={nodeOptions}
                  selected={nodeProperty ?? nodeOptions[0]?.value ?? ""}
                  onChange={setNodeProperty}
                  styleOptions={selectorStyle}
                />
              ) : (
                <span className="text-sm text-gray-700 py-1">
                  {nodeOptions[0]?.label}
                </span>
              ))}
            {classification.hasLinks &&
              linkOptions.length > 0 &&
              (linkOptions.length > 1 ? (
                <Selector
                  options={linkOptions}
                  selected={linkProperty ?? linkOptions[0]?.value ?? ""}
                  onChange={setLinkProperty}
                  styleOptions={selectorStyle}
                />
              ) : (
                <span className="text-sm text-gray-700 py-1">
                  {linkOptions[0]?.label}
                </span>
              ))}
          </>
        )}
      </div>
      <div className="relative flex-1 min-h-[120px]">
        <div className="absolute inset-0">
          <ChartStep
            selectedAssetIds={selectedAssetIds}
            nodeProperty={effectiveNodeProperty}
            linkProperty={effectiveLinkProperty}
            chartType={chartType}
            assetGroup={assetGroup}
            className="relative h-full w-full"
            hideLegend
          />
        </div>
      </div>
    </div>
  );
};

export function useMultiQuickGraph(selectedAssetIds: number[]) {
  const showQuickGraph = useShowQuickGraph();

  const footer = showQuickGraph ? (
    <MultiQuickGraphSection selectedAssetIds={selectedAssetIds} />
  ) : undefined;

  return { footer };
}
