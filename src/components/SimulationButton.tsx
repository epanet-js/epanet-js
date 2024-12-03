import {
  CheckCircledIcon,
  CrossCircledIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import MenuAction from "./menu_action";
import { translate } from "src/infra/i18n";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
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

type SimulationState = {
  status: "success" | "failure";
  report: string;
};

export const SimulationButton = () => {
  const data = useAtomValue(dataAtom);
  const [isSummaryOpen, setSummaryOpen] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [simulationState, setSimulationState] =
    useState<SimulationState | null>(null);

  const handleClick = async () => {
    setLoading(true);
    const inp = buildInp(data.hydraulicModel);
    const { report, status } = await webWorker.runSimulation(inp);
    setSimulationState({ status, report });
    setSummaryOpen(true);
    setLoading(false);
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
      {isLoading && <LoadingDialog />}
      {!!isSummaryOpen && simulationState && (
        <SummaryDialog
          simulationState={simulationState}
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
  simulationState,
  onClose,
}: {
  simulationState: SimulationState;
  onClose: () => void;
}) => {
  const icon =
    simulationState.status === "success" ? (
      <CheckCircledIcon className="w-8 h-8 text-green-500" />
    ) : (
      <CrossCircledIcon className="w-8 h-8 text-red-500" />
    );
  const title =
    simulationState.status === "success"
      ? translate("simulationSuccess")
      : translate("simulationFailure");

  const formattedReport = useMemo(() => {
    const rows = simulationState.report.split("\n");
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
  }, [simulationState.report]);

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
