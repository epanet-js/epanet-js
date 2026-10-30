import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "src/components/elements";
import { FileSystemHelpers } from "src/infra/storage";
import { PaywallLockButton } from "src/components/form/paywall";
import { usePermissions } from "src/hooks/use-permissions";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import type { ScriptAttachment, ScriptRunOutcome } from "src/lib/scripting";
import type { ScriptConsoleLine, ScriptRunState } from "src/state/scripts";
import {
  DownloadIcon,
  ErrorIcon,
  StopSimulationIcon,
  SuccessIcon,
} from "src/icons";

export const ConsoleLines = ({ lines }: { lines: ScriptConsoleLine[] }) => {
  const translate = useTranslate();
  if (lines.length === 0) {
    return (
      <span className="text-subtle">
        {translate("scripting.noConsoleOutput")}
      </span>
    );
  }
  return (
    <>
      {lines.map((line, i) => (
        <ConsoleLine key={i} line={line} />
      ))}
    </>
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

export const RunStatus = ({ outcome }: { outcome: ScriptRunOutcome }) => {
  const translate = useTranslate();
  if (outcome.status === "cancelled") {
    return (
      <StatusRow
        icon={<StopSimulationIcon />}
        iconClass="text-info"
        text={translate("scripting.runCancelled")}
      />
    );
  }
  if (outcome.status === "error") {
    const { name, message, line } = outcome.error;
    const error = `${name}: ${message}`;
    return (
      <StatusRow
        icon={<ErrorIcon />}
        iconClass="text-error"
        text={
          line !== null
            ? translate("scripting.errorAtLine", error, String(line))
            : error
        }
      />
    );
  }
  return (
    <StatusRow
      icon={<SuccessIcon />}
      iconClass="text-success"
      text={translate("scripting.finished")}
    />
  );
};

export const RunResultDeprecated = ({
  outcome,
}: {
  outcome: ScriptRunOutcome;
}) => {
  const translate = useTranslate();
  if (outcome.status !== "success") return <RunStatus outcome={outcome} />;
  return (
    <div className="flex flex-col gap-2">
      <RunStatus outcome={outcome} />
      {outcome.attachments.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-size-small font-semibold text-default">
            {translate("scripting.files")}
          </div>
          {outcome.attachments.map((attachment) => (
            <AttachmentRow key={attachment.name} attachment={attachment} />
          ))}
        </div>
      )}
      {outcome.selectionSets.length > 0 && (
        <CollectionsResult
          title={translate("collections.selectionSets.title")}
          labels={outcome.selectionSets.map((s) => s.label)}
        />
      )}
      {outcome.bookmarks.length > 0 && (
        <CollectionsResult
          title={translate("collections.bookmarks.title")}
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
  const translate = useTranslate();
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
          {translate("scripting.collectionsNotSaved")}
        </div>
      )}
      {labels.map((label, i) => (
        <div key={i} className="truncate text-size-base" title={label}>
          {label}
        </div>
      ))}
    </div>
  );
};

export const useDownloadAttachment = () => {
  const userTracking = useUserTracking();
  return (attachment: ScriptAttachment) => {
    userTracking.capture({
      name: "script.attachmentDownloaded",
      sizeKb: Math.max(1, Math.round(attachment.content.length / 1024)),
    });
    void FileSystemHelpers.downloadFile(attachment.name, attachment.content);
  };
};

const AttachmentRow = ({ attachment }: { attachment: ScriptAttachment }) => {
  const translate = useTranslate();
  const downloadAttachment = useDownloadAttachment();
  return (
    <div className="flex items-center gap-2 text-size-base">
      <span className="truncate flex-auto" title={attachment.name}>
        {attachment.name}
      </span>
      <span className="text-size-small text-subtle tabular-nums shrink-0">
        {formatSize(attachment.content.length)}
      </span>
      <Button size="xs" onClick={() => downloadAttachment(attachment)}>
        <DownloadIcon size="sm" />
        {translate("scripting.download")}
      </Button>
    </div>
  );
};

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

export const useElapsed = (run: ScriptRunState): number => {
  const running = run.status === "running";
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  return (run.finishedAt ?? now) - run.startedAt;
};

export const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const formatSize = (chars: number): string =>
  chars >= 1024 * 1024
    ? `${(chars / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(chars / 1024))} kB`;
