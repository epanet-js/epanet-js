const LOCAL_STORAGE_KEY = "DEBUG_DB_PERFORMANCE";

const isMainThread = typeof window !== "undefined";

let enabled = readInitialEnabled();
let prefix = isMainThread ? "db [main]" : "db [worker]";

function readInitialEnabled(): boolean {
  if (!isMainThread) return false;
  try {
    return window.localStorage.getItem(LOCAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export const isPerfLoggingEnabled = (): boolean => enabled;

export const setPerfLogging = (isEnabled: boolean, label?: string): void => {
  enabled = isEnabled;
  if (label) prefix = label;
};

type Meta = Record<string, unknown> | undefined;

const formatMeta = (meta: Meta): string => {
  if (!meta) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    parts.push(`${key}=${String(value)}`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

const log = (label: string, durationMs: number, meta: Meta): void => {
  const duration = durationMs.toFixed(2);
  // eslint-disable-next-line no-console
  console.log(`DEBUG ${prefix} ${label} ${duration}ms${formatMeta(meta)}`);
};

export const timed = async <T>(
  label: string,
  fn: () => Promise<T> | T,
  meta?: Meta,
): Promise<T> => {
  if (!enabled) return await fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    log(label, performance.now() - start, meta);
  }
};

export const timedWith = async <T>(
  label: string,
  fn: () => Promise<T> | T,
  metaFn: (result: T) => Meta,
): Promise<T> => {
  if (!enabled) return await fn();
  const start = performance.now();
  const result = await fn();
  log(label, performance.now() - start, metaFn(result));
  return result;
};
