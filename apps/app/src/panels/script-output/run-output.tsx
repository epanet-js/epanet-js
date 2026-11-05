import { useEffect, useState } from "react";
import { strToU8, zip } from "fflate";
import type { ReactNode } from "react";
import { FileSystemHelpers } from "src/infra/storage";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import type { ScriptAttachment, ScriptRunOutcome } from "src/lib/scripting";
import type { ScriptConsoleLine, ScriptRunState } from "src/state/scripts";
import { ErrorIcon, StopSimulationIcon, SuccessIcon } from "src/icons";

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
  if (line.level === "error") {
    return (
      <div className="-ml-1 px-1 py-1.5 rounded-sm text-error bg-error-subtle">
        {line.text}
      </div>
    );
  }
  const color = line.level === "warn" ? "text-warning" : "text-default";
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
    return (
      <StatusRow
        icon={<ErrorIcon />}
        iconClass="text-error"
        text={translate("scripting.finishedWithErrors")}
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

export const useDownloadAttachmentsZip = () => {
  const userTracking = useUserTracking();
  return (scriptName: string, attachments: ScriptAttachment[]) => {
    const files = Object.fromEntries(
      attachments.map(({ name, content }) => [name, strToU8(content)]),
    );
    zip(files, (error, data) => {
      if (error) return captureError(error);
      userTracking.capture({
        name: "script.attachmentsZipDownloaded",
        count: attachments.length,
        sizeKb: Math.max(1, Math.round(data.length / 1024)),
      });
      const fileName = `${scriptName.replace(/[\\/:*?"<>|]/g, "-")}.zip`;
      void FileSystemHelpers.downloadFile(fileName, data);
    });
  };
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
