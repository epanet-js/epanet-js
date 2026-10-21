import * as Progress from "@radix-ui/react-progress";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAtom } from "jotai";
import { Button } from "src/components/elements";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { FileSystemHelpers } from "src/infra/storage";
import { PaywallLockButton } from "src/components/form/paywall";
import { usePermissions } from "src/hooks/use-permissions";
import type { ScriptAttachment, ScriptRunOutcome } from "src/lib/scripting";
import {
  scriptRunAtom,
  type ScriptConsoleLine,
  type ScriptRunState,
} from "src/state/scripts";
import {
  DownloadIcon,
  ErrorIcon,
  StopSimulationIcon,
  SuccessIcon,
} from "src/icons";

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
              action: cancelling ? "Cancelling…" : "Cancel",
              onClick: () => {
                setCancelling(true);
                run.cancel();
              },
            }}
          />
        ) : (
          <SimpleDialogActions action="Close" onAction={onClose} />
        )
      }
    >
      <div className="p-4 text-size-base text-default flex flex-col gap-4">
        {running && <RunProgress run={run} elapsedMs={elapsedMs} />}
        {run.outcome && <RunResult outcome={run.outcome} />}
        <div
          ref={consoleRef}
          className="h-64 overflow-auto placemark-scrollbar bg-panel border rounded p-4 font-mono text-size-base text-default whitespace-pre-wrap"
        >
          {run.lines.length === 0 && (
            <span className="text-subtle">No console output</span>
          )}
          {run.lines.map((line, i) => (
            <ConsoleLine key={i} line={line} />
          ))}
        </div>
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
  const percent = run.progress === null ? null : run.progress * 100;
  return (
    <div>
      <div className="flex flex-row items-baseline gap-1 mb-2">
        <p className="text-size-base text-subtle">Running</p>
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

const ConsoleLine = ({ line }: { line: ScriptConsoleLine }) => {
  if (line.type === "table") {
    return (
      <div className="overflow-x-auto my-1">
        <table className="border-collapse text-left">
          <thead>
            <tr>
              {line.columns.map((column, i) => (
                <th key={i} className="border px-2 py-0.5 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {line.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border px-2 py-0.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const color =
    line.level === "error"
      ? "text-error"
      : line.level === "warn"
        ? "text-warning"
        : "text-default";
  return <div className={color}>{line.text}</div>;
};

const RunResult = ({ outcome }: { outcome: ScriptRunOutcome }) => {
  if (outcome.status === "cancelled") {
    return (
      <StatusRow
        icon={<StopSimulationIcon />}
        iconClass="text-info"
        text="Run cancelled"
      />
    );
  }
  if (outcome.status === "error") {
    const { name, message, line } = outcome.error;
    const location = line !== null ? ` (line ${line})` : "";
    return (
      <StatusRow
        icon={<ErrorIcon />}
        iconClass="text-error"
        text={`${name}: ${message}${location}`}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <StatusRow
        icon={<SuccessIcon />}
        iconClass="text-success"
        text="Script finished"
      />
      {outcome.attachments.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-size-small font-semibold text-default">
            Files
          </div>
          {outcome.attachments.map((attachment) => (
            <AttachmentRow key={attachment.name} attachment={attachment} />
          ))}
        </div>
      )}
      {outcome.selectionSets.length > 0 && (
        <CollectionsResult
          title="Selection sets"
          labels={outcome.selectionSets.map((s) => s.label)}
        />
      )}
      {outcome.bookmarks.length > 0 && (
        <CollectionsResult
          title="Bookmarks"
          labels={outcome.bookmarks.map((b) => b.label)}
        />
      )}
    </div>
  );
};

const CollectionsResult = ({
  title,
  labels,
}: {
  title: string;
  labels: string[];
}) => {
  const { canManageCollections } = usePermissions();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-size-small font-semibold text-default">
        {title}
        {!canManageCollections && (
          <PaywallLockButton feature="selectionSets" label={title} />
        )}
      </div>
      {!canManageCollections && (
        <div className="text-size-base text-subtle">
          Not saved. Your plan does not include collections.
        </div>
      )}
      {labels.map((label, i) => (
        <div key={i} className="truncate text-size-base">
          {label}
        </div>
      ))}
    </div>
  );
};

const AttachmentRow = ({ attachment }: { attachment: ScriptAttachment }) => (
  <div className="flex items-center gap-2 text-size-base">
    <span className="truncate flex-auto">{attachment.name}</span>
    <span className="text-size-small text-subtle tabular-nums shrink-0">
      {formatSize(attachment.content.length)}
    </span>
    <Button
      size="xs"
      onClick={() =>
        void FileSystemHelpers.downloadFile(attachment.name, attachment.content)
      }
    >
      <DownloadIcon size="sm" />
      Download
    </Button>
  </div>
);

const StatusRow = ({
  icon,
  iconClass,
  text,
}: {
  icon: ReactNode;
  iconClass: string;
  text: string;
}) => (
  <div className="flex items-start gap-2">
    <div className={`mt-0.5 ${iconClass}`}>{icon}</div>
    <span>{text}</span>
  </div>
);

const useElapsed = (run: ScriptRunState): number => {
  const running = run.status === "running";
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  return (run.finishedAt ?? now) - run.startedAt;
};

const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatSize = (chars: number): string =>
  chars >= 1024 * 1024
    ? `${(chars / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(chars / 1024))} kB`;
