let baseUrl: string | undefined;

export const setProjectionsBaseUrl = (url: string): void => {
  baseUrl = url.replace(/\/+$/, "");
};

export const getProjectionsBaseUrl = (): string => {
  if (!baseUrl) {
    throw new Error(
      "Projections base URL not set. Call setProjectionsBaseUrl() before using projection data.",
    );
  }
  return baseUrl;
};
