export type Dock = "left" | "right" | "center" | "bottom" | "vertical";
export type HorizontalDock = Exclude<Dock, "vertical" | "center">;
export type ResolvedLayout = "horizontal" | "vertical";

export const resolveLayout = (
  layout: string,
  isNarrowViewport: boolean,
): ResolvedLayout =>
  layout === "VERTICAL" || (layout === "AUTO" && isNarrowViewport)
    ? "vertical"
    : "horizontal";

export const VERTICAL_DOCK: Dock = "vertical";

const SIDE_PRIORITY: Record<HorizontalDock, number> = {
  right: 0,
  left: 1,
  bottom: 2,
};

export const bySidePriority = (a: HorizontalDock, b: HorizontalDock): number =>
  SIDE_PRIORITY[a] - SIDE_PRIORITY[b];
