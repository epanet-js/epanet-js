import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Selector } from "src/components/form/selector";
import {
  classifyAssetTypes,
  getAvailableProperties,
  type ChartProperty,
} from "../property-config";
import type { AssetType } from "src/hydraulic-model/asset-types";
import type { QuickGraphAssetType } from "src/state/quick-graph";

interface PropertySelectionStepProps {
  selectedAssetIds: number[];
  nodeProperty: string | null;
  linkProperty: string | null;
  onNodePropertyChange: (p: string) => void;
  onLinkPropertyChange: (p: string) => void;
}

export function PropertySelectionStep({
  selectedAssetIds,
  nodeProperty,
  linkProperty,
  onNodePropertyChange,
  onLinkPropertyChange,
}: PropertySelectionStepProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const simulation = useAtomValue(simulationDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);

  const qualityType = useMemo(() => {
    if ("epsResultsReader" in simulation && simulation.epsResultsReader) {
      return simulation.epsResultsReader.qualityType;
    }
    return null;
  }, [simulation]);

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

  const buildOptions = (props: ChartProperty[]) =>
    props.map((p) => {
      const label = translate(p.labelKey);
      const unit = units[p.quantityKey as keyof typeof units];
      return {
        value: p.value,
        label: unit ? `${label} (${translateUnit(unit)})` : label,
      };
    });

  const nodeOptions = useMemo(() => {
    const types = classification.nodeTypes as QuickGraphAssetType[];
    return buildOptions(getAvailableProperties(types, qualityType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classification.nodeTypes, qualityType, units]);

  const linkOptions = useMemo(() => {
    const types = classification.linkTypes as QuickGraphAssetType[];
    return buildOptions(getAvailableProperties(types, qualityType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classification.linkTypes, qualityType, units]);

  const isMixed = classification.hasNodes && classification.hasLinks;

  const nodeCount = assetTypes.filter((t) =>
    classification.nodeTypes.includes(t as any),
  ).length;
  const linkCount = assetTypes.filter((t) =>
    classification.linkTypes.includes(t as any),
  ).length;

  const nodeTypeSummary =
    classification.nodeTypes.length === 1
      ? translate(classification.nodeTypes[0])
      : "Nodes";
  const linkTypeSummary =
    classification.linkTypes.length === 1
      ? translate(classification.linkTypes[0])
      : "Links";

  const selectorStyle = {
    border: true,
    textSize: "text-sm" as const,
    paddingY: 1,
  };

  if (isMixed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {translate(
              "chartBuilder.leftAxis",
              nodeTypeSummary,
              String(nodeCount),
            )}
          </label>
          {nodeOptions.length > 0 ? (
            <Selector
              options={nodeOptions}
              selected={nodeProperty ?? nodeOptions[0]?.value ?? ""}
              onChange={onNodePropertyChange}
              styleOptions={selectorStyle}
            />
          ) : (
            <span className="text-sm text-gray-400">
              No chartable properties
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {translate(
              "chartBuilder.rightAxis",
              linkTypeSummary,
              String(linkCount),
            )}
          </label>
          {linkOptions.length > 0 ? (
            <Selector
              options={linkOptions}
              selected={linkProperty ?? linkOptions[0]?.value ?? ""}
              onChange={onLinkPropertyChange}
              styleOptions={selectorStyle}
            />
          ) : (
            <span className="text-sm text-gray-400">
              No chartable properties
            </span>
          )}
        </div>
      </div>
    );
  }

  const options = classification.hasNodes ? nodeOptions : linkOptions;
  const selected = classification.hasNodes
    ? (nodeProperty ?? options[0]?.value ?? "")
    : (linkProperty ?? options[0]?.value ?? "");
  const onChange = classification.hasNodes
    ? onNodePropertyChange
    : onLinkPropertyChange;

  return (
    <div className="flex flex-col gap-2">
      {options.length > 0 ? (
        <Selector
          options={options}
          selected={selected}
          onChange={onChange}
          styleOptions={selectorStyle}
        />
      ) : (
        <span className="text-sm text-gray-400">No chartable properties</span>
      )}
    </div>
  );
}
