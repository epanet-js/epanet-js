export type Dock = "left" | "right" | "center" | "bottom";
export type ResolvedLayout = "horizontal" | "vertical";

export const resolveLayout = (layout: string): ResolvedLayout =>
  layout === "VERTICAL" ? "vertical" : "horizontal";
export const VERTICAL_DOCK: Dock = "bottom";
