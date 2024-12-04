import {
  CheckCircledIcon,
  CircleIcon,
  CountdownTimerIcon,
  CrossCircledIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import MenuAction from "./menu_action";
import { translate } from "src/infra/i18n";
import { useAtom, useAtomValue } from "jotai";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { buildInp } from "src/simulation/build-inp";
import { DialogHeader } from "./dialog";
import { ReactNode, Suspense, useMemo, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  B3Size,
  DefaultErrorBoundary,
  Loading,
  StyledDialogContent,
  StyledDialogOverlay,
} from "./elements";
import { lib as webWorker } from "src/lib/worker";

export const SimulationStatusText = () => {
  const simulation = useAtomValue(simulationAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);

  const { icon, colorClass, text } = useMemo(() => {
    switch (simulation.status) {
      case "idle":
        return {
          icon: <CircleIcon />,
          colorClass: "text-gray-500",
          text: "Ready to run",
        };
      case "running":
        return {
          icon: <CircleIcon />,
          colorClass: "text-gray-500",
          text: "Running...",
        };
      case "success":
        if (hydraulicModel.version !== simulation.modelVersion) {
          return {
            icon: <CountdownTimerIcon />,
            colorClass: "text-orange-500",
            text: translate("simulationOutdated"),
          };
        }

        return {
          icon: <CheckCircledIcon />,
          colorClass: "text-green-500",
          text: translate("simulationSuccess"),
        };
      case "failure":
        return {
          icon: <CrossCircledIcon />,
          colorClass: "text-red-500",
          text: translate("simulationFailure"),
        };
    }
  }, [simulation, hydraulicModel.version]);

  return (
    <div
      className={`flex flex-row items-center space-x-1 p-2 text-sm ${colorClass}`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
};

export const SimulationButton = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [isSummaryOpen, setSummaryOpen] = useState<boolean>(false);

  const [simulation, setSimulationState] = useAtom(simulationAtom);

  const handleClick = async () => {
    setSimulationState({ status: "running" });
    const inp = buildInp(hydraulicModel);
    const { report, status } = await webWorker.runSimulation(inp);
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
        <LightningBoltIcon />
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
      const trimmedRow = row.trim();
      let content = <p>{trimmedRow}</p>;
      if (trimmedRow.startsWith("***")) {
        content = <hr />;
      } else if (trimmedRow.startsWith("*") && trimmedRow.endsWith("*")) {
        content = (
          <p className="font-[600]">{trimmedRow.replaceAll("*", "")}</p>
        );
      }
      return (
        <div key={i}>
          {content}
          {i < rows.length - 1 && <br />}
        </div>
      );
    });
  }, [report]);

  return (
    <Dialog onClose={onClose}>
      <DialogHeader title={title}>{icon}</DialogHeader>

      <div className="p-4 border rounded-sm text-sm bg-gray-100 text-gray-700">
        {formattedReport}
      </div>
    </Dialog>
  );
};

const Dialog = ({
  onClose = () => {},
  children,
  size = "sm",
}: {
  onClose?: () => void;
  children: ReactNode;
  size?: B3Size;
}) => {
  return (
    <RadixDialog.Root
      open={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
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
          >
            <DefaultErrorBoundary>{children}</DefaultErrorBoundary>
          </StyledDialogContent>
        </Suspense>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
