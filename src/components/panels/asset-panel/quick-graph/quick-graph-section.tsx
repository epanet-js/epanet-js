import { useCallback, useMemo, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PinIcon, PinOffIcon } from "src/icons";
import { Button } from "src/components/elements";
import { Section } from "src/components/form/fields";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import {
  assetPanelFooterPinnedAtom,
  quickGraphPropertyAtom,
  type QuickGraphAssetType,
  type QuickGraphPropertyByAssetType,
} from "src/state/quick-graph";
import type { QuantityProperty } from "src/model-metadata/quantities-spec";
import { useTimeSeries } from "./use-time-series";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { QuickGraphChart } from "./quick-graph-chart";

const QUICK_GRAPH_PROPERTIES: {
  [K in QuickGraphAssetType]: {
    value: QuickGraphPropertyByAssetType[K];
    labelKey: string;
    quantityKey: QuantityProperty;
  }[];
} = {
  junction: [
    { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
    { value: "head", labelKey: "head", quantityKey: "head" },
    { value: "demand", labelKey: "actualDemand", quantityKey: "actualDemand" },
  ],
  pipe: [
    { value: "flow", labelKey: "flow", quantityKey: "flow" },
    { value: "velocity", labelKey: "velocity", quantityKey: "velocity" },
    {
      value: "headloss",
      labelKey: "unitHeadloss",
      quantityKey: "unitHeadloss",
    },
  ],
  pump: [
    { value: "flow", labelKey: "flow", quantityKey: "flow" },
    { value: "headloss", labelKey: "pumpHead", quantityKey: "head" },
  ],
  valve: [
    { value: "flow", labelKey: "flow", quantityKey: "flow" },
    { value: "velocity", labelKey: "velocity", quantityKey: "velocity" },
    { value: "headloss", labelKey: "headlossShort", quantityKey: "headloss" },
  ],
  tank: [
    { value: "level", labelKey: "level", quantityKey: "level" },
    { value: "volume", labelKey: "volume", quantityKey: "volume" },
    { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
    { value: "head", labelKey: "head", quantityKey: "head" },
  ],
  reservoir: [{ value: "head", labelKey: "head", quantityKey: "head" }],
};

export const useShowQuickGraph = () => {
  const simulation = useAtomValue(simulationAtom);
  const isQuickGraphEnabled = useFeatureFlag("FLAG_QUICK_GRAPH");
  const hadValidSimulationRef = useRef(false);

  if (!isQuickGraphEnabled) return false;

  const hasCompletedSimulation =
    simulation.status === "success" || simulation.status === "warning";

  if (hasCompletedSimulation) {
    const metadata = getSimulationMetadata(simulation.metadata);
    hadValidSimulationRef.current = metadata.reportingStepsCount > 1;
  }

  if (hasCompletedSimulation) {
    return hadValidSimulationRef.current;
  }

  if (simulation.status === "running") {
    return hadValidSimulationRef.current;
  }

  return false;
};

interface QuickGraphSectionProps {
  assetId: number;
  assetType: QuickGraphAssetType;
}

const QuickGraphSection = ({ assetId, assetType }: QuickGraphSectionProps) => {
  const translate = useTranslate();
  const [isPinned, setIsPinned] = useAtom(assetPanelFooterPinnedAtom);
  const [propertyByType, setPropertyByType] = useAtom(quickGraphPropertyAtom);
  const simulation = useAtomValue(simulationAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);

  const selectedProperty = propertyByType[assetType];
  const selectedOption = QUICK_GRAPH_PROPERTIES[assetType].find(
    (opt) => opt.value === selectedProperty,
  );
  const decimals = selectedOption
    ? quantities.getDecimals(selectedOption.quantityKey)
    : undefined;

  const { data, isLoading } = useTimeSeries({
    assetId,
    assetType,
    property: selectedProperty,
  });

  const values = useMemo(() => (data ? Array.from(data.values) : []), [data]);
  const timeStepIndex =
    simulation.status === "success" || simulation.status === "warning"
      ? simulation.currentTimestepIndex
      : 0;

  const propertyOptions = useMemo(() => {
    const options = QUICK_GRAPH_PROPERTIES[assetType];
    return options.map((opt) => {
      const label = translate(opt.labelKey);
      const unit = quantities.getUnit(opt.quantityKey);
      return {
        value: opt.value,
        label: unit ? `${label} (${unit})` : label,
      };
    });
  }, [assetType, translate, quantities]);

  const handlePropertyChange = useCallback(
    (value: QuickGraphPropertyByAssetType[typeof assetType]) => {
      setPropertyByType((prev) => ({
        ...prev,
        [assetType]: value,
      }));
    },
    [assetType, setPropertyByType],
  );

  const handlePinToggle = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, [setIsPinned]);

  const pinButton = (
    <div className="flex h-8 my-[-0.5rem]">
      <Button
        variant="quiet"
        onClick={handlePinToggle}
        title={isPinned ? translate("unpin") : translate("pin")}
        aria-label={isPinned ? translate("unpin") : translate("pin")}
        data-state-on={isPinned || undefined}
      >
        {isPinned ? <PinOffIcon /> : <PinIcon />}
      </Button>
    </div>
  );

  return (
    <Section title={translate("quickGraph")} button={pinButton}>
      <Selector
        options={propertyOptions}
        selected={selectedProperty}
        onChange={handlePropertyChange}
        styleOptions={{
          border: true,
          textSize: "text-sm",
          paddingY: 2,
        }}
      />

      <div className="relative h-[100px]">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data !== null ? (
          <QuickGraphChart
            values={values}
            intervalSeconds={data.intervalSeconds}
            intervalsCount={data.intervalsCount}
            currentIntervalIndex={timeStepIndex}
            decimals={decimals}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            {translate("errorLoadingData")}
          </div>
        )}
      </div>
    </Section>
  );
};

const QuickGraphFeature = ({ assetId, assetType }: QuickGraphSectionProps) => {
  const showQuickGraph = useShowQuickGraph();
  return showQuickGraph ? (
    <QuickGraphSection assetId={assetId} assetType={assetType} />
  ) : null;
};

export const QuickGraph = QuickGraphFeature;
