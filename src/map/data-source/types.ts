export type DataSource =
  | "imported-features"
  | "features"
  | "icons"
  | "selected-features"
  | "ephemeral";

export const FeatureSources = {
  MAIN: "imported-features" as const,
  DELTA: "features" as const,
} satisfies Record<string, DataSource>;
