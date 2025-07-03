import { isDebugOn } from "./debug-mode";
import { captureWarning } from "./error-tracking";
import { monitorFrequency } from "./monitor-frequency";

type Settings = {
  name: string;
  maxDurationMs?: number;
  maxCalls?: number;
  callsIntervalMs?: number;
};

export const withDebugInstrumentation =
  <T extends (...args: any[]) => any>(
    fn: T,
    settings: Settings,
  ): ((...args: Parameters<T>) => ReturnType<T>) =>
  (...args: Parameters<T>): ReturnType<T> => {
    checkCallsFrequency(settings);
    const start = performance.now();

    const result = fn(...args);

    if (result instanceof Promise) {
      //eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result.then((value) => {
        if (isDebugOn) checkDuration(settings, start);
        //eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value;
      }) as ReturnType<T>;
    } else {
      if (isDebugOn) checkDuration(settings, start);
      //eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    }
  };

const checkDuration = (settings: Settings, start: number) => {
  const end = performance.now();
  const duration = end - start;
  const thresholdMs = settings.maxDurationMs;
  if (thresholdMs && duration > thresholdMs) {
    captureWarning(
      `${settings.name} over threshold ${thresholdMs.toFixed(2)} ms: Execution time: ${duration.toFixed(2)} ms`,
    );
  }
  //eslint-disable-next-line
  console.log(`${settings.name} execution time: ${duration.toFixed(2)} ms`);
};

const checkCallsFrequency = (settings: Settings) => {
  if (settings.maxCalls && settings.callsIntervalMs)
    monitorFrequency(settings.name, {
      limit: settings.maxCalls,
      intervalMs: settings.callsIntervalMs,
    });
};
