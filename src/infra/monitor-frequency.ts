import { isDebugOn } from "./debug-mode";
import { captureWarning } from "./error-tracking";

type MonitorOptions = {
  limit: number;
  intervalMs: number;
};

const monitors: { [name: string]: { calls: number[]; alerted: boolean } } = {};

export const monitorFrequency = (
  name: string,
  { limit, intervalMs }: MonitorOptions,
) => {
  if (!monitors[name]) {
    monitors[name] = { calls: [], alerted: false };
  }

  const monitor = monitors[name];

  //eslint-disable-next-line
  if (isDebugOn) console.log(`Monitor: ${name} called`);

  const now = Date.now();
  monitor.calls.push(now);

  while (monitor.calls[0] < now - intervalMs) {
    monitor.calls.shift();
  }

  if (monitor.calls.length > limit && !monitor.alerted) {
    captureWarning(
      `Too many calls! ${name} called more than ${limit} times in ${intervalMs}ms interval`,
    );
    monitor.alerted = true;

    setTimeout(() => {
      monitor.alerted = false;
    }, intervalMs);
  }
};
