import { useCallback, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import * as C from "@radix-ui/react-collapsible";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PinIcon,
  PinOffIcon,
} from "src/icons";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { simulationAtom } from "src/state/jotai";
import { useChangeTimestep } from "src/commands/change-timestep";
import {
  quickGraphOpenAtom,
  quickGraphPinnedAtom,
  quickGraphPropertyAtom,
  QUICK_GRAPH_PROPERTIES,
  type AssetType,
  type QuickGraphProperty,
} from "src/state/quick-graph";
import { QuickGraphChart } from "./quick-graph-chart";
import { useTimeSeries } from "./use-time-series";

interface QuickGraphSectionProps {
  assetId: number;
  assetType: AssetType;
}

export function QuickGraphSection({
  assetId,
  assetType,
}: QuickGraphSectionProps) {
  const translate = useTranslate();
  const simulation = useAtomValue(simulationAtom);
  const [isOpen, setIsOpen] = useAtom(quickGraphOpenAtom);
  const [isPinned, setIsPinned] = useAtom(quickGraphPinnedAtom);
  const [propertyByType, setPropertyByType] = useAtom(quickGraphPropertyAtom);
  const { changeTimestep } = useChangeTimestep();

  const selectedProperty = propertyByType[assetType];

  // Get time-series data
  const { data, isLoading, error } = useTimeSeries({
    assetId,
    assetType,
    property: selectedProperty,
  });

  // Get current timestep from simulation state
  const currentTimestepIndex = useMemo(() => {
    if (simulation.status === "success" || simulation.status === "warning") {
      return simulation.currentTimestepIndex;
    }
    return undefined;
  }, [simulation]);

  // Build property options for this asset type
  const propertyOptions = useMemo(() => {
    const options = QUICK_GRAPH_PROPERTIES[assetType];
    return options.map((opt) => ({
      value: opt.value,
      label: translate(opt.labelKey),
    }));
  }, [assetType, translate]);

  // Handle property change
  const handlePropertyChange = useCallback(
    (value: QuickGraphProperty) => {
      setPropertyByType((prev) => ({
        ...prev,
        [assetType]: value,
      }));
    },
    [assetType, setPropertyByType],
  );

  // Handle timestep click on chart
  const handleTimestepClick = useCallback(
    (timestepIndex: number) => {
      void changeTimestep(timestepIndex, "quickGraph");
    },
    [changeTimestep],
  );

  // Handle pin toggle
  const handlePinToggle = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, [setIsPinned]);

  // Check if simulation has run
  const hasSimulation =
    simulation.status === "success" || simulation.status === "warning";

  // Detect dark mode
  const isDarkMode =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (!hasSimulation) {
    return null;
  }

  return (
    <C.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <C.Trigger
            className={clsx(
              "flex items-center text-sm font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-gray-100",
              "p-2 -mx-2 -mt-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex-1",
              {
                "mb-1": isOpen,
              },
            )}
          >
            <span>{translate("quickGraph")}</span>
            <div className="flex-1 border-b border-gray-200 mx-3 mb-1" />
            {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </C.Trigger>
          <button
            onClick={handlePinToggle}
            className={clsx(
              "p-1 -mt-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
              "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
              {
                "text-purple-500 dark:text-purple-400": isPinned,
              },
            )}
            title={isPinned ? translate("unpin") : translate("pin")}
            aria-label={isPinned ? translate("unpin") : translate("pin")}
          >
            {isPinned ? <PinIcon size="sm" /> : <PinOffIcon size="sm" />}
          </button>
        </div>

        <C.Content className="flex flex-col gap-2">
          {/* Chart */}
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {error ? (
              <div className="h-[100px] flex items-center justify-center text-gray-400 text-xs">
                {translate("errorLoadingData")}
              </div>
            ) : data ? (
              <QuickGraphChart
                values={data.values}
                timestepCount={data.timestepCount}
                reportingTimeStep={data.reportingTimeStep}
                currentTimestepIndex={currentTimestepIndex}
                onTimestepClick={handleTimestepClick}
                isDarkMode={isDarkMode}
                noDataMessage={translate("noDataAvailable")}
              />
            ) : null}
          </div>

          {/* Property selector */}
          <div className="flex items-center gap-2">
            <Selector
              options={propertyOptions}
              selected={selectedProperty}
              onChange={handlePropertyChange}
              styleOptions={{
                textSize: "text-xs",
                border: true,
                paddingX: 2,
                paddingY: 1,
              }}
            />
          </div>
        </C.Content>
      </div>
    </C.Root>
  );
}
