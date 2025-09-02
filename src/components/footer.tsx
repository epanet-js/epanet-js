import {
  CheckCircledIcon,
  CircleIcon as DeprecatedCircleIcon,
  CountdownTimerIcon,
  CrossCircledIcon,
  DoubleArrowLeftIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { useAtomValue } from "jotai";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { SimulationState, dataAtom, simulationAtom } from "src/state/jotai";
import * as Popover from "@radix-ui/react-popover";
import { Button, StyledPopoverArrow, StyledPopoverContent } from "./elements";
import { HydraulicModel } from "src/hydraulic-model";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

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
  const { hydraulicModel, modelMetadata } = useAtomValue(dataAtom);
  const isXlOrLarger = useBreakpoint("xl");
  const isLgOrLarger = useBreakpoint("lg");
  const isSmOrLarger = useBreakpoint("sm");

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-gray-50 border-t border-gray-300 shadow-lg">
      <div className="flex flex-row items-center text-sm text-gray-500 space-x-1">
        {!isXlOrLarger && (
          <div className="px-2">
            <CollapsedPopover
              unitsSpecName={modelMetadata.quantities.specName}
              demandMultiplier={hydraulicModel.demands.multiplier}
              headlossFormula={hydraulicModel.headlossFormula}
            />
          </div>
        )}
        <div className="border-r-2 border-gray-100 h-10"></div>
        {isXlOrLarger && (
          <>
            <span className="px-4 py-2">
              {translate("autoLengths")}: {translate("on")}
            </span>
            <div className="border-r-2 border-gray-150 h-10"></div>
            <span className="px-4 py-2">
              {translate("autoElevations")}: {translate("on")}
            </span>
            <div className="border-r-2 border-gray-150 h-10"></div>
          </>
        )}
        {isLgOrLarger && (
          <>
            <span className="px-4 py-2">
              {translate("units")}: {modelMetadata.quantities.specName}
            </span>
            <div className="border-r-2 border-gray-150 h-10"></div>
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
              {localizeDecimal(hydraulicModel.demands.multiplier)}
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
}: {
  unitsSpecName: string;
  headlossFormula: string;
  demandMultiplier: number;
}) => {
  const translate = useTranslate();
  const isLgOrLarger = useBreakpoint("lg");
  const isSmOrLarger = useBreakpoint("sm");
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="quiet">
          {isLucideIconsOn ? (
            <ChevronsLeftIcon className="text-gray-500" />
          ) : (
            <DoubleArrowLeftIcon className="w-4 h-4 text-gray-500" />
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <StyledPopoverContent size="auto">
          <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-4 text-sm text-gray-500 p-2">
            <span>{translate("autoLengths")}</span>
            <span className="text-gray-700">{translate("on")}</span>

            <span>{translate("autoElevations")}</span>
            <span className="text-gray-700">{translate("on")}</span>

            {!isLgOrLarger && (
              <>
                <span>{translate("units")}</span>
                <span className="text-gray-700">{unitsSpecName}</span>
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

const buildSimulationStatusStyles = (
  simulation: SimulationState,
  hydraulicModel: HydraulicModel,
  translate: (key: string, ...variables: string[]) => string,
  isLucideIconsOn: boolean,
) => {
  switch (simulation.status) {
    case "idle":
      return {
        Icon: isLucideIconsOn ? CircleIcon : DeprecatedCircleIcon,
        colorClass: "text-gray-500",
        text: translate("simulationReadyToRun"),
      };
    case "running":
      return {
        Icon: isLucideIconsOn ? CircleIcon : DeprecatedCircleIcon,
        colorClass: "text-gray-500",
        text: translate("simulationRunning"),
      };
    case "success":
      if (hydraulicModel.version !== simulation.modelVersion) {
        return {
          Icon: isLucideIconsOn ? OutdatedSimulationIcon : CountdownTimerIcon,
          colorClass: "text-orange-500",
          text: translate("simulationOutdated"),
        };
      }

      return {
        Icon: isLucideIconsOn ? SuccessIcon : CheckCircledIcon,
        colorClass: "text-green-500",
        text: translate("simulationSuccess"),
      };
    case "failure":
      if (hydraulicModel.version !== simulation.modelVersion) {
        return {
          Icon: isLucideIconsOn ? OutdatedSimulationIcon : CountdownTimerIcon,
          colorClass: "text-orange-500",
          text: translate("simulationOutdated"),
        };
      }

      return {
        Icon: isLucideIconsOn ? ErrorIcon : CrossCircledIcon,
        colorClass: "text-red-500",
        text: translate("simulationFailure"),
      };
    case "warning":
      if (hydraulicModel.version !== simulation.modelVersion) {
        return {
          Icon: isLucideIconsOn ? OutdatedSimulationIcon : CountdownTimerIcon,
          colorClass: "text-orange-500",
          text: translate("simulationOutdated"),
        };
      }

      return {
        Icon: isLucideIconsOn ? WarningIcon : ExclamationTriangleIcon,
        colorClass: "text-yellow-600",
        text: translate("simulationWarning"),
      };
  }
};

export const SimulationStatusText = () => {
  const translate = useTranslate();
  const simulation = useAtomValue(simulationAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const { Icon, colorClass, text } = buildSimulationStatusStyles(
    simulation,
    hydraulicModel,
    translate,
    isLucideIconsOn,
  );

  return (
    <div
      className={`flex flex-row items-center space-x-2 text-sm ${colorClass}`}
    >
      {isLucideIconsOn ? (
        <Icon className="mr-1" />
      ) : (
        <Icon className="w-4 h-4 mx-1" />
      )}
      {text}
    </div>
  );
};
