import { useCallback, useMemo, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PinIcon, PinOffIcon } from "src/icons";
import { Button } from "src/components/elements";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { simulationAtom } from "src/state/simulation";
import { worktreeAtom } from "src/state/scenarios";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import {
  assetPanelFooterAtom,
  quickGraphPropertyAtom,
  DEFAULT_FOOTER_HEIGHT,
  type QuickGraphAssetType,
  type QuickGraphPropertyByAssetType,
} from "src/state/quick-graph";
import type { QuantityProperty } from "src/lib/project-settings/quantities-spec";
import { getDecimals } from "src/lib/project-settings";
import type { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import type { AssetId, Valve } from "src/hydraulic-model/asset-types";
import { useTimeSeries } from "./use-time-series";
import { QuickGraphChart } from "./quick-graph-chart";
import { useChangeTimestep } from "src/commands/change-timestep";

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
    { value: "setting", labelKey: "setting", quantityKey: "tcvSetting" },
  ],
  tank: [
    { value: "level", labelKey: "level", quantityKey: "level" },
    { value: "volume", labelKey: "volume", quantityKey: "volume" },
    { value: "netFlow", labelKey: "netFlow", quantityKey: "netFlow" },
    { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
    { value: "head", labelKey: "head", quantityKey: "head" },
  ],
  reservoir: [
    { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
    { value: "head", labelKey: "head", quantityKey: "head" },
    { value: "netFlow", labelKey: "netFlow", quantityKey: "netFlow" },
  ],
};

export const useShowQuickGraph = () => {
  const simulation = useAtomValue(simulationAtom);
  const hadValidSimulationRef = useRef(false);

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
  assetType: QuickGraphAssetType;
  assetId: AssetId;
  data: TimeSeries | null;
  mainData: TimeSeries | null;
  isLoading: boolean;
}

const getValveSettingQuantityKey = (valve: Valve): QuantityProperty | null => {
  if (valve.kind === "tcv") return null;
  if (["psv", "prv", "pbv"].includes(valve.kind)) return "pressure";
  if (valve.kind === "fcv") return "flow";
  return null;
};

const QuickGraphSection = ({
  assetType,
  assetId,
  data,
  mainData,
  isLoading,
}: QuickGraphSectionProps) => {
  const translate = useTranslate();
  const [footerState, setFooterState] = useAtom(assetPanelFooterAtom);
  const [propertyByType, setPropertyByType] = useAtom(quickGraphPropertyAtom);
  const simulation = useAtomValue(simulationAtom);
  const worktree = useAtomValue(worktreeAtom);
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const { changeTimestep } = useChangeTimestep();

  const isInScenario = worktree.activeSnapshotId !== worktree.mainId;
  const activeSnapshot = worktree.snapshots.get(worktree.activeSnapshotId);
  const scenarioName = isInScenario ? (activeSnapshot?.name ?? null) : null;
  const mainLabel = isInScenario ? translate("scenarios.main") : null;

  const selectedProperty = propertyByType[assetType];
  const selectedOption = QUICK_GRAPH_PROPERTIES[assetType].find(
    (opt) => opt.value === selectedProperty,
  );
  const decimals = useMemo(() => {
    if (!selectedOption) return 0;
    let quantityKey = selectedOption.quantityKey;
    if (assetType === "valve" && selectedProperty === "setting") {
      const valve = hydraulicModel.assets.get(assetId) as Valve | undefined;
      if (valve) {
        quantityKey = getValveSettingQuantityKey(valve) ?? quantityKey;
      }
    }
    return getDecimals(formatting, quantityKey) ?? 0;
  }, [
    selectedOption,
    assetType,
    selectedProperty,
    assetId,
    hydraulicModel,
    formatting,
  ]);

  const values = useMemo(() => (data ? Array.from(data.values) : []), [data]);
  const mainValues = useMemo(
    () => (mainData ? Array.from(mainData.values) : null),
    [mainData],
  );
  const timeStepIndex =
    simulation.status === "success" || simulation.status === "warning"
      ? (simulation.currentTimestepIndex ?? 0)
      : 0;

  const propertyOptions = useMemo(() => {
    const hasCompletedSimulation =
      simulation.status === "success" || simulation.status === "warning";
    const hasWaterAge =
      hasCompletedSimulation &&
      getSimulationMetadata(simulation.metadata).qualityType === "age";

    const baseOptions = QUICK_GRAPH_PROPERTIES[assetType];
    const options =
      hasWaterAge &&
      (assetType === "junction" ||
        assetType === "tank" ||
        assetType === "reservoir")
        ? [
            ...baseOptions,
            {
              value: "waterAge" as const,
              labelKey: "waterAge",
              quantityKey: "waterAge" as QuantityProperty,
            },
          ]
        : baseOptions;

    return options.map((opt) => {
      const label = translate(opt.labelKey);
      let quantityKey = opt.quantityKey;
      if (assetType === "valve" && opt.value === "setting") {
        const valve = hydraulicModel.assets.get(assetId) as Valve | undefined;
        if (valve) {
          quantityKey = getValveSettingQuantityKey(valve) ?? opt.quantityKey;
        }
      }
      const unit = units[quantityKey];
      return {
        value: opt.value,
        label: unit ? `${label} (${unit})` : label,
      };
    });
  }, [assetType, assetId, hydraulicModel, translate, units, simulation]);

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
    setFooterState((prev) => ({
      isPinned: !prev.isPinned,
      height: DEFAULT_FOOTER_HEIGHT,
    }));
  }, [setFooterState]);

  const handleIntervalClick = useCallback(
    (intervalIndex: number) => {
      void changeTimestep(intervalIndex, "quick-graph");
    },
    [changeTimestep],
  );

  const { isPinned } = footerState;

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
    <div className="flex flex-col flex-1 min-h-0 pl-5">
      <div className="flex items-center justify-between text-sm font-semibold h-8">
        {translate("quickGraph")}
        {pinButton}
      </div>
      <div className="w-max pb-2">
        {propertyOptions.length > 1 ? (
          <Selector
            options={propertyOptions}
            selected={selectedProperty}
            onChange={handlePropertyChange}
            styleOptions={{
              border: true,
              textSize: "text-sm",
              paddingY: 1,
            }}
          />
        ) : (
          <span className="text-sm text-gray-700 py-1">
            {propertyOptions[0]?.label}
          </span>
        )}
      </div>

      <div className="relative flex-1 min-h-[120px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {data !== null ? (
          <div className="absolute inset-0">
            <QuickGraphChart
              values={values}
              mainValues={mainValues}
              mainLabel={mainLabel}
              intervalSeconds={data.intervalSeconds}
              intervalsCount={data.intervalsCount}
              currentIntervalIndex={timeStepIndex}
              decimals={decimals}
              onIntevalClick={handleIntervalClick}
              scenarioName={scenarioName}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            {translate("errorLoadingData")}
          </div>
        )}
      </div>
    </div>
  );
};

export const QuickGraph = QuickGraphSection;

export function useQuickGraph<T extends QuickGraphAssetType>(
  assetId: number,
  assetType: T,
) {
  const showQuickGraph = useShowQuickGraph();
  const [propertyByType] = useAtom(quickGraphPropertyAtom);
  const selectedProperty = propertyByType[assetType];

  const { data, mainData, isLoading } = useTimeSeries({
    assetId,
    assetType,
    property: selectedProperty,
  });

  const footer = showQuickGraph ? (
    <QuickGraph
      assetId={assetId}
      assetType={assetType}
      data={data}
      mainData={mainData}
      isLoading={isLoading}
    />
  ) : undefined;

  return { footer };
}
