import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { scriptRunAtom, type ScriptRunState } from "src/state/scripts";
import { useTranslate } from "src/hooks/use-translate";
import {
  ConsoleLines,
  RunResult,
  formatElapsed,
  useElapsed,
} from "./run-output";

export const ScriptOutputPanel = () => {
  const run = useAtomValue(scriptRunAtom);
  if (!run) {
    return (
      <div className="h-full flex items-center justify-center text-size-base text-subtle">
        Run a script to see its output here.
      </div>
    );
  }
  return <RunOutput run={run} />;
};

const RunOutput = ({ run }: { run: ScriptRunState }) => {
  const translate = useTranslate();
  const consoleRef = useRef<HTMLDivElement>(null);
  const elapsedMs = useElapsed(run);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run.lines]);

  return (
    <div className="h-full flex flex-row min-h-0">
      <div
        ref={consoleRef}
        className="flex-1 min-w-0 overflow-auto placemark-scrollbar p-3 font-mono text-size-base text-default whitespace-pre-wrap"
      >
        <ConsoleLines lines={run.lines} />
      </div>
      <div className="w-72 shrink-0 border-l overflow-auto placemark-scrollbar p-3 flex flex-col gap-3 text-size-base text-default">
        <div className="flex flex-col gap-0.5">
          <div className="font-semibold truncate">{run.name}</div>
          <div className="text-subtle tabular-nums">
            {run.status === "running"
              ? translate("scripting.running")
              : formatElapsed(elapsedMs)}
          </div>
        </div>
        {run.outcome && <RunResult outcome={run.outcome} />}
      </div>
    </div>
  );
};
