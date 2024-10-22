export const isFeatureOn = (name: string) => {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);

  const flag = params.get(name);
  if (!flag) return false;

  return flag === "true";
};
