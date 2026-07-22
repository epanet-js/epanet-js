import { captureWarning } from "src/infra/error-tracking";

type ProbeEntry = {
  seq: number;
  label: string;
  detail?: Record<string, unknown>;
};

const RING_SIZE = 60;
const BURST_THRESHOLD = 30;

const ring: ProbeEntry[] = [];
let seq = 0;
let burst = 0;
let frameScheduled = false;
let reported = false;

const scheduleBurstReset = () => {
  if (frameScheduled) return;
  frameScheduled = true;
  if (typeof requestAnimationFrame === "undefined") {
    burst = 0;
    frameScheduled = false;
    return;
  }
  requestAnimationFrame(() => {
    burst = 0;
    frameScheduled = false;
  });
};

export const recordGridUpdate = (
  label: string,
  detail?: Record<string, unknown>,
) => {
  seq += 1;
  ring.push({ seq, label, detail });
  if (ring.length > RING_SIZE) ring.shift();

  burst += 1;
  scheduleBurstReset();

  if (burst >= BURST_THRESHOLD && !reported) {
    reported = true;
    captureWarning("Data grid update loop detected", undefined, {
      "Grid Update Loop": {
        burst,
        recentUpdates: ring.map(
          (entry) =>
            `${entry.seq}:${entry.label}${entry.detail ? " " + JSON.stringify(entry.detail) : ""}`,
        ),
      },
    });
  }
};
