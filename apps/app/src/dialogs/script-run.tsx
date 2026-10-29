import * as Progress from "@radix-ui/react-progress";
import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";
import { scriptRunAtom, type ScriptRunState } from "src/state/scripts";
import {
  ConsoleLines,
  RunResult,
  formatElapsed,
  useElapsed,
} from "src/panels/script-output/run-output";

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
  const isScriptOutputPanelOn = useFeatureFlag("FLAG_SCRIPT_OUTPUT_PANEL");
  const [cancelling, setCancelling] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const elapsedMs = useElapsed(run);
  const running = run.status === "running";

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run.lines]);

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
        {!isScriptOutputPanelOn && (
          <>
            {run.outcome && (
              <RunResult outcome={run.outcome} collections="saved" />
            )}
            <div
              ref={consoleRef}
              className="h-64 overflow-auto placemark-scrollbar bg-panel border rounded p-4 font-mono text-size-base text-default whitespace-pre-wrap"
            >
              <ConsoleLines lines={run.lines} />
            </div>
          </>
        )}
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
  const percent = run.progress === null ? null : run.progress * 100;
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
      {run.progressMessage && (
        <p className="mt-2 text-size-base text-subtle truncate">
          {run.progressMessage}
        </p>
      )}
    </div>
  );
};
