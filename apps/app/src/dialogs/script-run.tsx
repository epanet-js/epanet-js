import * as Progress from "@radix-ui/react-progress";
import { useState } from "react";
import { useAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { scriptRunAtom, type ScriptRunState } from "src/state/scripts";
import { formatElapsed, useElapsed } from "src/panels/script-output/run-output";
import {
  formatSimulationTime,
  simulationPhaseLabel,
} from "./simulation-progress";

export const ScriptRunDialog = ({ onClose }: { onClose: () => void }) => {
  const [run, setRun] = useAtom(scriptRunAtom);
  if (!run) return null;

  return (
    <RunningScriptDialog
      run={run}
      onClose={() => {
        setRun(null);
        onClose();
      }}
    />
  );
};

const RunningScriptDialog = ({
  run,
  onClose,
}: {
  run: ScriptRunState;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [cancelling, setCancelling] = useState(false);
  const elapsedMs = useElapsed(run);
  const running = run.status === "running";

  return (
    <BaseDialog
      title={run.name}
      size="md"
      isOpen={true}
      onClose={onClose}
      preventClose={running}
      footer={
        running ? (
          <SimpleDialogActions
            isSubmitting={cancelling}
            secondary={{
              action: cancelling
                ? translate("scripting.cancelling")
                : translate("dialog.cancel"),
              onClick: () => {
                setCancelling(true);
                run.cancel();
              },
            }}
          />
        ) : (
          <SimpleDialogActions
            action={translate("dialog.close")}
            onAction={onClose}
          />
        )
      }
    >
      <div className="p-4 text-size-base text-default flex flex-col gap-4">
        {running && <RunProgress run={run} elapsedMs={elapsedMs} />}
      </div>
    </BaseDialog>
  );
};

const RunProgress = ({
  run,
  elapsedMs,
}: {
  run: ScriptRunState;
  elapsedMs: number;
}) => {
  const translate = useTranslate();
  const { simulation } = run;
  const fraction = simulation
    ? simulation.phase !== "finalizing" && simulation.totalDuration > 0
      ? simulation.currentTime / simulation.totalDuration
      : null
    : run.progress;
  const percent = fraction === null ? null : fraction * 100;
  const message = simulation
    ? simulation.phase === "finalizing"
      ? simulationPhaseLabel(translate, simulation.phase)
      : `${simulationPhaseLabel(translate, simulation.phase)} ${formatSimulationTime(simulation.currentTime)}`
    : run.progressMessage;
  return (
    <div>
      <div className="flex flex-row items-baseline gap-1 mb-2">
        <p className="text-size-base text-subtle">
          {translate("scripting.running")}
        </p>
        <p className="text-size-base font-bold text-default tabular-nums">
          {formatElapsed(elapsedMs)}
        </p>
      </div>
      <Progress.Root
        className="relative overflow-hidden bg-track rounded-full w-full h-2"
        value={percent}
        max={100}
      >
        {percent === null ? (
          <Progress.Indicator className="bg-accent h-full w-1/4 rounded-full progress-indeterminate" />
        ) : (
          <Progress.Indicator
            className="bg-accent w-full h-full"
            style={{ transform: `translateX(-${100 - percent}%)` }}
          />
        )}
      </Progress.Root>
      {message && (
        <p className="mt-2 text-size-base text-subtle truncate">{message}</p>
      )}
    </div>
  );
};
