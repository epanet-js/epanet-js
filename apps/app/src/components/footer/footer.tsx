import { useAtomValue } from "jotai";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";

import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { autoElevationsAtom } from "src/state/drawing";
import { SimulationState } from "src/state/simulation";

import {
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
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
  StopSimulationIcon,
} from "src/icons";

export const Footer = () => {
  const translate = useTranslate();
  const projectSettings = useAtomValue(projectSettingsAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const translateUnit = useTranslateUnit();
  const isLgOrLarger = useBreakpoint("lg");
  const isSmOrLarger = useBreakpoint("sm");

  const flowUnitDisplay = translateUnit(projectSettings.units.flow);
  const pressureUnitDisplay = translateUnit(projectSettings.units.pressure);

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-panel border-t border-strong shadow-lg z-10">
      <div className="flex flex-row items-center text-size-base text-subtle space-x-1">
        {!isLgOrLarger && (
          <div className="px-2">
            <CollapsedPopover
              demandMultiplier={simulationSettings.globalDemandMultiplier}
              headlossFormula={projectSettings.headlossFormula}
              flowUnitDisplay={flowUnitDisplay}
              pressureUnitDisplay={pressureUnitDisplay}
            />
          </div>
        )}
        <div className="border-r-2 border-gray-100 h-10"></div>
        <ScenarioSwitcher />
        <div className="border-r-2 border-base h-10"></div>
        {isLgOrLarger && (
          <>
            <span className="px-4 py-2">
              {translate("flow")}: {flowUnitDisplay}
            </span>
            <div className="border-r-2 border-base h-10"></div>
            <span className="px-4 py-2">
              {translate("pressure")}: {pressureUnitDisplay}
            </span>
            <div className="border-r-2 border-base h-10"></div>
            <span className="px-4 py-2">
              {translate("headlossShort")}: {projectSettings.headlossFormula}
            </span>
            <div className="border-r-2 border-base h-10"></div>
          </>
        )}
        {isSmOrLarger && (
          <>
            <span className="px-4 py-2">
              {translate("demandMultiplier")}:{" "}
              {localizeDecimal(simulationSettings.globalDemandMultiplier)}
            </span>
            <div className="border-r-2 border-base h-10"></div>
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
  headlossFormula,
  demandMultiplier,
  flowUnitDisplay,
  pressureUnitDisplay,
}: {
  headlossFormula: string;
  demandMultiplier: number;
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
          <ChevronsLeftIcon className="text-subtle" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <StyledPopoverContent size="auto">
          <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-4 text-size-base text-subtle p-2">
            <span>{translate("autoLengths")}</span>
            <span className="text-default">{translate("on")}</span>

            <span>{translate("autoElevations")}</span>
            <span className="text-default">
              {translate(autoElevations ? "on" : "off")}
            </span>

            {!isLgOrLarger && (
              <>
                <span>{translate("flow")}</span>
                <span className="text-default">{flowUnitDisplay}</span>
                <span>{translate("pressure")}</span>
                <span className="text-default">{pressureUnitDisplay}</span>
                <span>{translate("headlossShort")}</span>
                <span className="text-default">{headlossFormula}</span>
              </>
            )}

            {!isSmOrLarger && (
              <>
                <span>{translate("demandMultiplier")}</span>
                <span className="text-default">
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
        colorClass: "text-subtle",
        text: translate("simulationReadyToRun"),
      };
    case "running":
      return {
        Icon: CircleIcon,
        colorClass: "text-subtle",
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
        colorClass: "text-error",
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
    case "stopped":
      return {
        Icon: StopSimulationIcon,
        colorClass: "text-blue-500",
        text: translate("simulationStopped"),
      };
  }
};

export const SimulationStatusText = () => {
  const translate = useTranslate();
  const simulation = useAtomValue(simulationDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);

  const { Icon, colorClass, text } = buildSimulationStatusStyles(
    simulation,
    hydraulicModel,
    simulationSettings.version,
    translate,
  );

  return (
    <div
      className={`flex flex-row items-center space-x-2 text-size-base ${colorClass}`}
    >
      <Icon className="mr-1" />
      {text}
    </div>
  );
};
