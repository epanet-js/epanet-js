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
  QUICK_GRAPH_PROPERTIES,
  type QuickGraphAssetType,
  type QuickGraphPropertyByAssetType,
} from "src/state/quick-graph";
import { useTimeSeries } from "./use-time-series";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { QuickGraphChart } from "./quick-graph-chart";

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
  const quantityKey =
    selectedProperty === "demand" ? "actualDemand" : selectedProperty;
  const decimals = quantities.getDecimals(
    quantityKey as Parameters<typeof quantities.getDecimals>[0],
  );

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
    return options.map((opt) => ({
      value: opt.value,
      label: translate(opt.labelKey),
    }));
  }, [assetType, translate]);

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
    <Button
      variant="ultra-quiet"
      size="xxs"
      onClick={handlePinToggle}
      title={isPinned ? translate("unpin") : translate("pin")}
      aria-label={isPinned ? translate("unpin") : translate("pin")}
      data-state-on={isPinned || undefined}
    >
      {isPinned ? <PinOffIcon size="sm" /> : <PinIcon size="sm" />}
    </Button>
  );

  return (
    <Section title={translate("quickGraph")} button={pinButton}>
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
