import {
  CheckCircledIcon,
  CircleIcon,
  CountdownTimerIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { isFeatureOn } from "src/infra/feature-flags";
import { translate } from "src/infra/i18n";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { dataAtom, simulationAtom } from "src/state/jotai";

export const Footer = () => {
  const { hydraulicModel, modelMetadata } = useAtomValue(dataAtom);
  const isLgOrLarger = useBreakpoint("lg");
  const isMdOrLarger = useBreakpoint("md");
  const isSmOrLarger = useBreakpoint("sm");

  const items: string[] = useMemo(
    () =>
      !isFeatureOn("FLAG_RESPONSIVE") || isLgOrLarger
        ? [
            `${translate("autoLengths")}: ${translate("on")}`,
            `${translate("autoElevations")}: ${translate("on")}`,
            `${translate("units")}: ${modelMetadata.quantities.specName}`,
            `${translate("headlossShort")}: ${hydraulicModel.headlossFormula}`,
            `${translate("demandMultiplier")}: ${localizeDecimal(hydraulicModel.demands.multiplier)}`,
          ]
        : isMdOrLarger
          ? [
              `${translate("units")}: ${modelMetadata.quantities.specName}`,
              `${translate("headlossShort")}: ${hydraulicModel.headlossFormula}`,
              `${translate("demandMultiplier")}: ${localizeDecimal(hydraulicModel.demands.multiplier)}`,
            ]
          : [
              `${translate("demandMultiplier")}: ${localizeDecimal(hydraulicModel.demands.multiplier)}`,
            ],
    [hydraulicModel, modelMetadata, isLgOrLarger, isMdOrLarger],
  );

  if (isFeatureOn("FLAG_RESPONSIVE") && !isSmOrLarger) return null;

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-300 shadow-md ">
      <div className="flex flex-row items-center text-sm text-gray-500 space-x-1">
        <div className="border-r-2 border-gray-100 h-10"></div>
        {items.map((item, i) => (
          <>
            <span key={i} className="px-4 py-2">
              {item}
            </span>
            <div className="border-r-2 border-gray-100 h-10"></div>
          </>
        ))}
        <span className="px-1">
          <SimulationStatusText />
        </span>
      </div>
    </nav>
  );
};

export const SimulationStatusText = () => {
  const simulation = useAtomValue(simulationAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);

  const { Icon, colorClass, text } = useMemo(() => {
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
        if (hydraulicModel.version !== simulation.modelVersion) {
          return {
            Icon: CountdownTimerIcon,
            colorClass: "text-orange-500",
            text: translate("simulationOutdated"),
          };
        }

        return {
          Icon: CheckCircledIcon,
          colorClass: "text-green-500",
          text: translate("simulationSuccess"),
        };
      case "failure":
        if (hydraulicModel.version !== simulation.modelVersion) {
          return {
            Icon: CountdownTimerIcon,
            colorClass: "text-orange-500",
            text: translate("simulationOutdated"),
          };
        }

        return {
          Icon: CrossCircledIcon,
          colorClass: "text-red-500",
          text: translate("simulationFailure"),
        };
      case "warning":
        if (hydraulicModel.version !== simulation.modelVersion) {
          return {
            Icon: CountdownTimerIcon,
            colorClass: "text-orange-500",
            text: translate("simulationOutdated"),
          };
        }

        return {
          Icon: ExclamationTriangleIcon,
          colorClass: "text-yellow-600",
          text: translate("simulationWarning"),
        };
    }
  }, [simulation, hydraulicModel.version]);

  return (
    <div
      className={`flex flex-row items-center space-x-2 text-sm ${colorClass}`}
    >
      <Icon className="w-4 h-4 mx-1" />
      {text}
    </div>
  );
};
