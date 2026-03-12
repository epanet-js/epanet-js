import { useAtomValue } from "jotai";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { dataAtom } from "src/state/data";
import { autoElevationsAtom } from "src/state/drawing";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { SimulationState, simulationAtom } from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import * as Popover from "@radix-ui/react-popover";
import { Button, StyledPopoverArrow, StyledPopoverContent } from "../elements";
import { HydraulicModel } from "src/hydraulic-model";
import { ScenarioSwitcher } from "./scenario-switcher";

import {
  ErrorIcon,
  SuccessIcon,
  WarningIcon,
  ChevronsLeftIcon,
  CircleIcon,
  OutdatedSimulationIcon,
} from "src/icons";

export const Footer = () => {
  const translate = useTranslate();
  const { modelMetadata } = useAtomValue(dataAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const simulationSettings = useAtomValue(simulationSettingsAtom);
  const isEpanet23On = useFeatureFlag("FLAG_EPANET23");
  const translateUnit = useTranslateUnit();
  const isLgOrLarger = useBreakpoint("lg");
  const isSmOrLarger = useBreakpoint("sm");

  const flowUnitDisplay = translateUnit(modelMetadata.units.flow);
  const pressureUnitDisplay = translateUnit(modelMetadata.units.pressure);

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-gray-50 border-t border-gray-300 shadow-lg z-10">
      <div className="flex flex-row items-center text-sm text-gray-500 space-x-1">
        {!isLgOrLarger && (
          <div className="px-2">
            <CollapsedPopover
              unitsSpecName={modelMetadata.quantities.specName}
              demandMultiplier={simulationSettings.globalDemandMultiplier}
              headlossFormula={hydraulicModel.headlossFormula}
              isEpanet23On={isEpanet23On}
              flowUnitDisplay={flowUnitDisplay}
              pressureUnitDisplay={pressureUnitDisplay}
            />
          </div>
        )}
        <div className="border-r-2 border-gray-100 h-10"></div>
        <ScenarioSwitcher />
        <div className="border-r-2 border-gray-150 h-10"></div>
        {isLgOrLarger && (
          <>
            {isEpanet23On ? (
              <>
                <span className="px-4 py-2">
                  {translate("flow")}: {flowUnitDisplay}
                </span>
                <div className="border-r-2 border-gray-150 h-10"></div>
                <span className="px-4 py-2">
                  {translate("pressure")}: {pressureUnitDisplay}
                </span>
                <div className="border-r-2 border-gray-150 h-10"></div>
              </>
            ) : (
              <>
                <span className="px-4 py-2">
                  {translate("units")}: {modelMetadata.quantities.specName}
                </span>
                <div className="border-r-2 border-gray-150 h-10"></div>
              </>
            )}
            <span className="px-4 py-2">
              {translate("headlossShort")}: {hydraulicModel.headlossFormula}
            </span>
            <div className="border-r-2 border-gray-150 h-10"></div>
          </>
        )}
        {isSmOrLarger && (
          <>
            <span className="px-4 py-2">
              {translate("demandMultiplier")}:{" "}
              {localizeDecimal(simulationSettings.globalDemandMultiplier)}
            </span>
            <div className="border-r-2 border-gray-150 h-10"></div>
          </>
        )}
        <span className="px-1">
          <SimulationStatusText />
        </span>
      </div>
    </nav>
  );
};

const CollapsedPopover = ({
  unitsSpecName,
  headlossFormula,
  demandMultiplier,
  isEpanet23On,
  flowUnitDisplay,
  pressureUnitDisplay,
}: {
  unitsSpecName: string;
  headlossFormula: string;
  demandMultiplier: number;
  isEpanet23On: boolean;
  flowUnitDisplay: string;
  pressureUnitDisplay: string;
}) => {
  const translate = useTranslate();
  const autoElevations = useAtomValue(autoElevationsAtom);
  const isLgOrLarger = useBreakpoint("lg");
  const isSmOrLarger = useBreakpoint("sm");
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="quiet">
          <ChevronsLeftIcon className="text-gray-500" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <StyledPopoverContent size="auto">
          <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-4 text-sm text-gray-500 p-2">
            <span>{translate("autoLengths")}</span>
            <span className="text-gray-700">{translate("on")}</span>

            <span>{translate("autoElevations")}</span>
            <span className="text-gray-700">
              {translate(autoElevations ? "on" : "off")}
            </span>

            {!isLgOrLarger && (
              <>
                {isEpanet23On ? (
                  <>
                    <span>{translate("flow")}</span>
                    <span className="text-gray-700">{flowUnitDisplay}</span>
                    <span>{translate("pressure")}</span>
                    <span className="text-gray-700">{pressureUnitDisplay}</span>
                  </>
                ) : (
                  <>
                    <span>{translate("units")}</span>
                    <span className="text-gray-700">{unitsSpecName}</span>
                  </>
                )}
                <span>{translate("headlossShort")}</span>
                <span className="text-gray-700">{headlossFormula}</span>
              </>
            )}

            {!isSmOrLarger && (
              <>
                <span>{translate("demandMultiplier")}</span>
                <span className="text-gray-700">
                  {localizeDecimal(demandMultiplier)}
                </span>
              </>
            )}
          </div>
          <StyledPopoverArrow />
        </StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};

const isOutdated = (
  simulation: { modelVersion: string; settingsVersion: string },
  hydraulicModel: HydraulicModel,
  settingsVersion: string,
) =>
  hydraulicModel.version !== simulation.modelVersion ||
  settingsVersion !== simulation.settingsVersion;

const buildSimulationStatusStyles = (
  simulation: SimulationState,
  hydraulicModel: HydraulicModel,
  settingsVersion: string,
  translate: (key: string, ...variables: string[]) => string,
) => {
  switch (simulation.status) {
    case "idle":
      return {
        Icon: CircleIcon,
        colorClass: "text-gray-500",
        text: translate("simulationReadyToRun"),
      };
    case "running":
      return {
        Icon: CircleIcon,
        colorClass: "text-gray-500",
        text: translate("simulationRunning"),
      };
    case "success":
      if (isOutdated(simulation, hydraulicModel, settingsVersion)) {
        return {
          Icon: OutdatedSimulationIcon,
          colorClass: "text-orange-500",
          text: translate("simulationOutdated"),
        };
      }

      return {
        Icon: SuccessIcon,
        colorClass: "text-green-500",
        text: translate("simulationSuccess"),
      };
    case "failure":
      if (isOutdated(simulation, hydraulicModel, settingsVersion)) {
        return {
          Icon: OutdatedSimulationIcon,
          colorClass: "text-orange-500",
          text: translate("simulationOutdated"),
        };
      }

      return {
        Icon: ErrorIcon,
        colorClass: "text-red-500",
        text: translate("simulationFailure"),
      };
    case "warning":
      if (isOutdated(simulation, hydraulicModel, settingsVersion)) {
        return {
          Icon: OutdatedSimulationIcon,
          colorClass: "text-orange-500",
          text: translate("simulationOutdated"),
        };
      }

      return {
        Icon: WarningIcon,
        colorClass: "text-yellow-600",
        text: translate("simulationWarning"),
      };
  }
};

export const SimulationStatusText = () => {
  const translate = useTranslate();
  const simulation = useAtomValue(simulationAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const simulationSettings = useAtomValue(simulationSettingsAtom);

  const { Icon, colorClass, text } = buildSimulationStatusStyles(
    simulation,
    hydraulicModel,
    simulationSettings.version,
    translate,
  );

  return (
    <div
      className={`flex flex-row items-center space-x-2 text-sm ${colorClass}`}
    >
      <Icon className="mr-1" />
      {text}
    </div>
  );
};
