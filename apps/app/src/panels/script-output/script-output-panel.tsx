import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useMove } from "@react-aria/interactions";
import { Tooltip } from "@epanet-js/ui-kit";
import {
  scriptRunAtom,
  type ScriptConsoleLine,
  type ScriptRunState,
} from "src/state/scripts";
import type { ScriptRunOutcome } from "src/lib/scripting";
import { useGoToScriptLine } from "src/commands/go-to-script-line";
import { panelContentStateAtom } from "src/state/panels";
import { contentStateFor, withContentState } from "src/panels/panel-template";
import { accumulateResize } from "src/components/resizer";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { CopyIcon } from "src/icons";
import { writeToClipboard } from "src/lib/utils";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import {
  ConsoleLines,
  RunStatus,
  formatElapsed,
  useElapsed,
} from "./run-output";
import { RunResult } from "./run-result";

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 200;
const MIN_CONSOLE_WIDTH = 200;

export const ScriptOutputPanel = ({ panelId }: { panelId: string }) => {
  const run = useAtomValue(scriptRunAtom);
  if (!run) {
    return (
      <div className="h-full flex items-center justify-center text-size-base text-subtle">
        Run a script to see its output here.
      </div>
    );
  }
  return <RunOutput run={run} panelId={panelId} />;
};

const RunOutput = ({
  run,
  panelId,
}: {
  run: ScriptRunState;
  panelId: string;
}) => {
  const translate = useTranslate();
  const containerRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const elapsedMs = useElapsed(run);
  const error = run.outcome?.status === "error" ? run.outcome.error : null;
  const [contentStates, setContentStates] = useAtom(panelContentStateAtom);
  const sidebarWidth =
    contentStateFor(contentStates, panelId, "script-output")?.sidebarWidth ??
    DEFAULT_SIDEBAR_WIDTH;

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run.lines, error]);

  return (
    <div ref={containerRef} className="h-full flex flex-row min-h-0">
      <div
        ref={consoleRef}
        className="flex-1 min-w-0 flex flex-row items-start overflow-auto placemark-scrollbar"
      >
        <div className="flex-1 min-w-0 py-2 pl-3 font-mono text-size-base text-default whitespace-pre-wrap">
          {!(error && run.lines.length === 0) && (
            <ConsoleLines lines={run.lines} />
          )}
          {error && <RunErrorLine error={error} run={run} />}
        </div>
        <div className="sticky top-0 shrink-0 flex flex-col items-center p-2">
          <CopyLogButton
            disabled={run.lines.length === 0 && !error}
            linesCount={run.lines.length}
            hasError={error !== null}
            getText={() =>
              logText(run.lines, error, (line) =>
                translate("scripting.atLine", String(line)),
              )
            }
          />
        </div>
      </div>
      <div
        className="relative shrink-0 border-l"
        style={{
          width: sidebarWidth,
          maxWidth: `calc(100% - ${MIN_CONSOLE_WIDTH}px)`,
        }}
      >
        <SidebarResizer
          width={sidebarWidth}
          maxWidth={() =>
            (containerRef.current?.clientWidth ?? Infinity) - MIN_CONSOLE_WIDTH
          }
          onWidthChange={(width) =>
            setContentStates((prev) =>
              withContentState(prev, panelId, "script-output", {
                sidebarWidth: width,
              }),
            )
          }
        />
        <div className="h-full overflow-auto placemark-scrollbar px-2 py-2 flex flex-col text-sm text-default">
          <div className="flex items-center h-8 px-1">
            <span className="font-semibold truncate" title={run.name}>
              {run.name}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 px-1 py-1.5">
            {run.outcome ? (
              <RunStatus outcome={run.outcome} />
            ) : (
              <span className="text-subtle">
                {translate("scripting.running")}
              </span>
            )}
            <span className="shrink-0 text-subtle tabular-nums">
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          {run.outcome && (
            <RunResult scriptName={run.name} outcome={run.outcome} />
          )}
        </div>
      </div>
    </div>
  );
};

const COPIED_FEEDBACK_MS = 1500;

const CopyLogButton = ({
  disabled,
  linesCount,
  hasError,
  getText,
}: {
  disabled: boolean;
  linesCount: number;
  hasError: boolean;
  getText: () => string;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Tooltip
      content={translate("scripting.logCopied")}
      side="left"
      sideOffset={4}
      open={copied}
    >
      <Button
        variant="quiet"
        size="xxs"
        className="h-8 w-8 justify-center"
        aria-label={translate("scripting.copyLog")}
        title={copied ? undefined : translate("scripting.copyLog")}
        disabled={disabled}
        onClick={() => {
          writeToClipboard(getText())
            .then(() => {
              setCopied(true);
              userTracking.capture({
                name: "script.logCopied",
                linesCount,
                hasError,
              });
            })
            .catch(captureError);
        }}
      >
        <CopyIcon />
      </Button>
    </Tooltip>
  );
};

type RunError = Extract<ScriptRunOutcome, { status: "error" }>["error"];

const logText = (
  lines: ScriptConsoleLine[],
  error: RunError | null,
  atLine: (line: number) => string,
): string => {
  const text = lines.map((line) =>
    line.type === "text"
      ? line.text
      : [line.columns, ...line.rows].map((row) => row.join("\t")).join("\n"),
  );
  if (error) {
    text.push(`${error.name}: ${error.message}`);
    if (error.line !== null) text.push(`  ${atLine(error.line)}`);
  }
  return text.join("\n");
};

const RunErrorLine = ({
  error: { name, message, line },
  run,
}: {
  error: RunError;
  run: ScriptRunState;
}) => {
  const translate = useTranslate();
  const goToLine = useGoToScriptLine(run.draft);
  return (
    <div className="-ml-1 px-1 py-1.5 rounded-sm text-error bg-error-subtle">
      <div>{`${name}: ${message}`}</div>
      {line !== null && (
        <div className="pl-4">
          {goToLine ? (
            <button
              type="button"
              className="text-left text-subtle underline underline-offset-2 hover:text-default"
              onClick={() => goToLine(line)}
            >
              {translate("scripting.atLine", String(line))}
            </button>
          ) : (
            translate("scripting.atLine", String(line))
          )}
        </div>
      )}
    </div>
  );
};

const SidebarResizer = ({
  width,
  maxWidth,
  onWidthChange,
}: {
  width: number;
  maxWidth: () => number;
  onWidthChange: (width: number) => void;
}) => {
  const rawWidth = useRef<number | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  const { moveProps } = useMove({
    onMoveStart() {
      rawWidth.current = widthRef.current;
    },
    onMove(e) {
      if (rawWidth.current === null) return;
      const { accumulated, value } = accumulateResize(
        rawWidth.current,
        -e.deltaX,
        {
          min: MIN_SIDEBAR_WIDTH,
          max: Math.max(MIN_SIDEBAR_WIDTH, maxWidth()),
        },
      );
      rawWidth.current = accumulated;
      onWidthChange(value);
    },
    onMoveEnd() {
      rawWidth.current = null;
    },
  });

  return (
    <button
      {...moveProps}
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      tabIndex={-1}
      style={{ cursor: "col-resize" }}
      className="absolute top-0 bottom-0 left-0 -translate-x-1/2 w-3 z-10
        touch-none
        flex items-center justify-center
        group"
    >
      <div
        className="w-0.5 h-full
          bg-purple-700 dark:bg-purple-700
          opacity-0
          group-hover:opacity-100
          pointer-events-none"
      />
    </button>
  );
};
