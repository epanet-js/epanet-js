const readFromLocalStorage = (key: "DEBUG_MODE" | "DEBUG_APP_STATE") => {
  if (typeof window === "undefined") return false;

  return localStorage.getItem(key) === "true";
};

export const isDebugOn =
  process.env.NEXT_PUBLIC_DEBUG_MODE === "true" ||
  readFromLocalStorage("DEBUG_MODE");

export const isDebugAppStateOn =
  isDebugOn || readFromLocalStorage("DEBUG_APP_STATE");
