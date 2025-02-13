import {
  CheckCircledIcon,
  CircleIcon,
  CountdownTimerIcon,
  CrossCircledIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import MenuAction from "./menu_action";
import { translate } from "src/infra/i18n";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { buildInp } from "src/simulation/build-inp";
import { runSimulation } from "src/simulation";
import { DialogHeader } from "./dialog";
import { ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  B3Size,
  DefaultErrorBoundary,
  Loading,
  StyledDialogContent,
  StyledDialogOverlay,
} from "./elements";
import { attachSimulation } from "src/hydraulic-model";
import { isFeatureOn } from "src/infra/feature-flags";

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
    }
  }, [simulation, hydraulicModel.version]);

  return (
    <div
      className={`flex flex-row items-center space-x-2 ${isFeatureOn("FLAG_HEADLOSS") ? "text-xs" : "text-sm"} ${colorClass}`}
    >
      <Icon className="w-4 h-4 mx-1" />
      {text}
    </div>
  );
};

export const SimulationButton = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [isSummaryOpen, setSummaryOpen] = useState<boolean>(false);

  const [simulation, setSimulationState] = useAtom(simulationAtom);
  const setData = useSetAtom(dataAtom);

  const handleClick = async () => {
    setSimulationState({ status: "running" });
    const inp = buildInp(hydraulicModel);
    const { report, status, results } = await runSimulation(inp);

    attachSimulation(hydraulicModel, results);
    setData((prev) => ({
      ...prev,
      hydraulicModel,
    }));

    setSimulationState({
      status,
      report,
      modelVersion: hydraulicModel.version,
    });
    setSummaryOpen(true);
  };
  return (
    <>
      <MenuAction
        label={translate("simulate")}
        role="button"
        onClick={handleClick}
        hotkey={"shift+enter"}
      >
        <LightningBoltIcon className="text-yellow-600" />
      </MenuAction>
      {simulation.status === "running" && <LoadingDialog />}
      {!!isSummaryOpen &&
        (simulation.status === "success" ||
          simulation.status === "failure") && (
          <SummaryDialog
            status={simulation.status}
            report={simulation.report}
            onClose={() => setSummaryOpen(false)}
          />
        )}
    </>
  );
};

const LoadingDialog = () => {
  return (
    <Dialog>
      <p>{translate("runningSimulation")}</p>
    </Dialog>
  );
};

const SummaryDialog = ({
  status,
  report,
  onClose,
}: {
  status: "success" | "failure";
  report: string;
  onClose: () => void;
}) => {
  const icon =
    status === "success" ? (
      <CheckCircledIcon className="w-6 h-6 text-green-500" />
    ) : (
      <CrossCircledIcon className="w-6 h-6 text-red-500" />
    );
  const title =
    status === "success"
      ? translate("simulationSuccess")
      : translate("simulationFailure");

  const formattedReport = useMemo(() => {
    const rows = report.split("\n");
    return rows.map((row, i) => {
      const trimmedRow = row.slice(2);
      return (
        <pre key={i}>
          {trimmedRow.startsWith("  Error") ? trimmedRow.slice(2) : trimmedRow}
        </pre>
      );
    });
  }, [report]);

  return (
    <Dialog onClose={onClose}>
      <DialogHeader title={title}>{icon}</DialogHeader>

      <div className="p-4 border rounded-sm text-sm bg-gray-100 text-gray-700 font-mono leading-loose">
        {formattedReport}
      </div>
    </Dialog>
  );
};

const Dialog = ({
  onClose,
  children,
  size = "sm",
}: {
  onClose?: () => void;
  children: ReactNode;
  size?: B3Size;
}) => {
  useEffect(() => {
    if (!onClose) return;
    const stopEscPropagation = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      onClose();
      e.stopImmediatePropagation();
    };
    const captureEarly = true;
    document.addEventListener("keydown", stopEscPropagation, captureEarly);
    return () => {
      document.removeEventListener("keydown", stopEscPropagation, captureEarly);
    };
  }, [onClose]);

  return (
    <RadixDialog.Root
      open={true}
      onOpenChange={(isOpen) => {
        if (!isOpen && onClose) {
          onClose();
        }
      }}
    >
      <RadixDialog.Trigger className="hidden">
        <div className="hidden"></div>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <StyledDialogOverlay />
        <Suspense fallback={<Loading />}>
          <StyledDialogContent
            onOpenAutoFocus={(e) => e.preventDefault()}
            size={size}
            widthClasses="max-w-620"
          >
            <DefaultErrorBoundary>{children}</DefaultErrorBoundary>
          </StyledDialogContent>
        </Suspense>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
