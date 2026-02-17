export type DataSource =
  | "main-features"
  | "delta-features"
  | "icons"
  | "selected-features"
  | "ephemeral"
  | "grid";

export const FeatureSources = {
  MAIN: "main-features" as const,
  DELTA: "delta-features" as const,
} satisfies Record<string, DataSource>;
