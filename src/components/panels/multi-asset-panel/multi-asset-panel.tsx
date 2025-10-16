import { useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { pluralize } from "src/lib/utils";
import { IWrappedFeature } from "src/types";
import { Quantities } from "src/model-metadata/quantities-spec";
import { SectionList, Section } from "src/components/form/fields";
import { MultiAssetActions } from "./actions";
import { Asset } from "src/hydraulic-model";
import { AssetTypeSections } from "./asset-type-sections";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/jotai";
import { computeMultiAssetData } from "./data";

export function MultiAssetPanel({
  selectedFeatures,
  quantitiesMetadata,
}: {
  selectedFeatures: IWrappedFeature[];
  quantitiesMetadata: Quantities;
}) {
  const translate = useTranslate();
  const simulationState = useAtomValue(simulationAtom);
  const hasSimulation = simulationState.status !== "idle";

  const { data: multiAssetData, counts: assetCounts } = useMemo(() => {
    const assets = selectedFeatures as Asset[];
    return computeMultiAssetData(assets, quantitiesMetadata);
  }, [selectedFeatures, quantitiesMetadata]);

  return (
    <SectionList>
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {translate("selection")} (
            {pluralize(translate, "asset", selectedFeatures.length)})
          </span>
          <MultiAssetActions />
        </div>
      </div>

      {assetCounts.junction > 0 && (
        <Section title={`${translate("junction")} (${assetCounts.junction})`}>
          <AssetTypeSections
            sections={multiAssetData.junction}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.pipe > 0 && (
        <Section title={`${translate("pipe")} (${assetCounts.pipe})`}>
          <AssetTypeSections
            sections={multiAssetData.pipe}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.pump > 0 && (
        <Section title={`${translate("pump")} (${assetCounts.pump})`}>
          <AssetTypeSections
            sections={multiAssetData.pump}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.valve > 0 && (
        <Section title={`${translate("valve")} (${assetCounts.valve})`}>
          <AssetTypeSections
            sections={multiAssetData.valve}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.reservoir > 0 && (
        <Section title={`${translate("reservoir")} (${assetCounts.reservoir})`}>
          <AssetTypeSections sections={multiAssetData.reservoir} />
        </Section>
      )}

      {assetCounts.tank > 0 && (
        <Section title={`${translate("tank")} (${assetCounts.tank})`}>
          <AssetTypeSections
            sections={multiAssetData.tank}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}
    </SectionList>
  );
}
