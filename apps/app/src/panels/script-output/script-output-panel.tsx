import { useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useMove } from "@react-aria/interactions";
import { scriptRunAtom, type ScriptRunState } from "src/state/scripts";
import { panelContentStateAtom } from "src/state/panels";
import { contentStateFor, withContentState } from "src/panels/panel-template";
import { accumulateResize } from "src/components/resizer";
import { useTranslate } from "src/hooks/use-translate";
import {
  ConsoleLines,
  RunResult,
  formatElapsed,
  useElapsed,
} from "./run-output";

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
  const [contentStates, setContentStates] = useAtom(panelContentStateAtom);
  const sidebarWidth =
    contentStateFor(contentStates, panelId, "script-output")?.sidebarWidth ??
    DEFAULT_SIDEBAR_WIDTH;

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run.lines]);

  return (
    <div ref={containerRef} className="h-full flex flex-row min-h-0">
      <div
        ref={consoleRef}
        className="flex-1 min-w-0 overflow-auto placemark-scrollbar p-3 font-mono text-size-base text-default whitespace-pre-wrap"
      >
        <ConsoleLines lines={run.lines} />
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
        <div className="h-full overflow-auto placemark-scrollbar p-3 flex flex-col gap-3 text-size-base text-default">
          <div className="flex flex-col gap-0.5">
            <div className="font-semibold truncate" title={run.name}>
              {run.name}
            </div>
            <div className="text-subtle tabular-nums">
              {run.status === "running"
                ? translate("scripting.running")
                : formatElapsed(elapsedMs)}
            </div>
          </div>
          {run.outcome && <RunResult outcome={run.outcome} />}
        </div>
      </div>
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
