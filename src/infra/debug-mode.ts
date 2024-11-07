const readFromLocalStorage = () => {
  if (typeof window === "undefined") return false;

  return localStorage.getItem("DEBUG_MODE") === "true";
};

export const isDebugOn =
  process.env.NEXT_PUBLIC_DEBUG_MODE === "true" || readFromLocalStorage();
