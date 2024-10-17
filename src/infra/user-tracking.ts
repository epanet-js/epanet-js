type Metadata = {
  [key: string]: boolean | string | number | string[];
};

export const trackUserAction = (event: string, metadata: Metadata = {}) => {
  if (process.env.NEXT_PUBLIC_SKIP_USER_TRACKING === "true") return

  // eslint-disable-next-line no-console
  console.log(`USER_TRACKING: ${event}`, metadata)
}
