const readFromLocalStorage = (
  key:
    | "DEBUG_MODE"
    | "DEBUG_APP_STATE"
    | "DEBUG_MAP_HANDLERS"
    | "DEBUG_TRACE_PROJECT_OPEN"
    | "DEBUG_TRACE_SCENARIO_SWITCH",
) => {
  if (typeof window === "undefined") return false;

  return localStorage.getItem(key) === "true";
};

export const isDebugOn =
  process.env.NEXT_PUBLIC_DEBUG_MODE === "true" ||
  readFromLocalStorage("DEBUG_MODE");

export const isDebugMapHandlers = readFromLocalStorage("DEBUG_MAP_HANDLERS");

export const isTraceProjectOpenOn = readFromLocalStorage(
  "DEBUG_TRACE_PROJECT_OPEN",
);

export const isTraceScenarioSwitchOn = readFromLocalStorage(
  "DEBUG_TRACE_SCENARIO_SWITCH",
);

export const isDebugAppStateOn =
  isDebugOn || readFromLocalStorage("DEBUG_APP_STATE");
