import { atom } from "jotai";

/**
 * Map drawing mode
 */
export enum Mode {
  NONE = "NONE",
  SELECT_RECTANGULAR = "SELECT_RECTANGULAR",
  SELECT_POLYGONAL = "SELECT_POLYGONAL",
  SELECT_FREEHAND = "SELECT_FREEHAND",
  DRAW_JUNCTION = "DRAW_JUNCTION",
  DRAW_PIPE = "DRAW_PIPE",
  DRAW_RESERVOIR = "DRAW_RESERVOIR",
  DRAW_PUMP = "DRAW_PUMP",
  DRAW_VALVE = "DRAW_VALVE",
  DRAW_TANK = "DRAW_TANK",
  DRAW_CUSTOMER_POINT = "DRAW_CUSTOMER_POINT",
  CONNECT_CUSTOMER_POINTS = "CONNECT_CUSTOMER_POINTS",
  REDRAW_LINK = "REDRAW_LINK",
  BOUNDARY_TRACE_SELECT = "BOUNDARY_TRACE_SELECT",
  UPSTREAM_TRACE_SELECT = "UPSTREAM_TRACE_SELECT",
  DOWNSTREAM_TRACE_SELECT = "DOWNSTREAM_TRACE_SELECT",
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface ModeOptions {}

export const MODE_INFO: Record<
  Mode,
  {
    name: string;
  }
> = {
  [Mode.NONE]: { name: "select" },
  [Mode.SELECT_RECTANGULAR]: { name: "rectangular selection" },
  [Mode.SELECT_POLYGONAL]: { name: "polygonal selection" },
  [Mode.SELECT_FREEHAND]: { name: "freehand selection" },
  [Mode.DRAW_JUNCTION]: { name: "junction" },
  [Mode.DRAW_PIPE]: { name: "pipe" },
  [Mode.DRAW_RESERVOIR]: { name: "reservoir" },
  [Mode.DRAW_PUMP]: { name: "pump" },
  [Mode.DRAW_VALVE]: { name: "valve" },
  [Mode.DRAW_TANK]: { name: "tank" },
  [Mode.DRAW_CUSTOMER_POINT]: { name: "customer point" },
  [Mode.CONNECT_CUSTOMER_POINTS]: { name: "connect customer points" },
  [Mode.REDRAW_LINK]: { name: "redraw link" },
  [Mode.BOUNDARY_TRACE_SELECT]: { name: "boundary trace" },
  [Mode.UPSTREAM_TRACE_SELECT]: { name: "upstream trace" },
  [Mode.DOWNSTREAM_TRACE_SELECT]: { name: "downstream trace" },
};

export type ModeWithOptions = {
  mode: Mode;
  modeOptions?: ModeOptions;
};

export const modeAtom = atom<ModeWithOptions>({
  mode: Mode.NONE,
});

export const lastSelectionModeAtom = atom<Mode>(Mode.SELECT_POLYGONAL);
export const lastTraceSelectModeAtom = atom<Mode>(Mode.BOUNDARY_TRACE_SELECT);
