import { useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { pluralize } from "src/lib/utils";
import { IWrappedFeature } from "src/types";
import { Quantities } from "src/model-metadata/quantities-spec";
import { SectionList, Section } from "src/components/form/fields";
import { MultiAssetActions } from "./actions";
import { Asset } from "src/hydraulic-model";
import {
  JunctionSection,
  PipeSection,
  PumpSection,
  ValveSection,
  ReservoirSection,
  TankSection,
} from "./asset-type-sections";
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

  const multiAssetData = useMemo(() => {
    const assets = selectedFeatures as Asset[];
    return computeMultiAssetData(assets, quantitiesMetadata);
  }, [selectedFeatures, quantitiesMetadata]);

  const assetCounts = useMemo(() => {
    const counts = {
      junction: 0,
      pipe: 0,
      pump: 0,
      valve: 0,
      reservoir: 0,
      tank: 0,
    };

    selectedFeatures.forEach((feature) => {
      const asset = feature as Asset;
      if (asset.type in counts) {
        counts[asset.type as keyof typeof counts]++;
      }
    });

    return counts;
  }, [selectedFeatures]);

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
          <JunctionSection
            sections={multiAssetData.junction}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.pipe > 0 && (
        <Section title={`${translate("pipe")} (${assetCounts.pipe})`}>
          <PipeSection
            sections={multiAssetData.pipe}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.pump > 0 && (
        <Section title={`${translate("pump")} (${assetCounts.pump})`}>
          <PumpSection
            sections={multiAssetData.pump}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.valve > 0 && (
        <Section title={`${translate("valve")} (${assetCounts.valve})`}>
          <ValveSection
            sections={multiAssetData.valve}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}

      {assetCounts.reservoir > 0 && (
        <Section title={`${translate("reservoir")} (${assetCounts.reservoir})`}>
          <ReservoirSection sections={multiAssetData.reservoir} />
        </Section>
      )}

      {assetCounts.tank > 0 && (
        <Section title={`${translate("tank")} (${assetCounts.tank})`}>
          <TankSection
            sections={multiAssetData.tank}
            hasSimulation={hasSimulation}
          />
        </Section>
      )}
    </SectionList>
  );
}
