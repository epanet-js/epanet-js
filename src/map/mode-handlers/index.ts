import type { HandlerContext } from "src/types";
import { Mode } from "src/state/jotai";
import { useNoneHandlers } from "./none";
import { useDrawNodeHandlers } from "./draw-node";
import { useDrawLinkHandlers } from "./draw-link";
import { useConnectCustomerPointsHandlers } from "./connect-customer-points";
import { useRedrawLinkHandlers } from "./redraw-link";

export function useModeHandlers(handlerContext: HandlerContext) {
  const HANDLERS: Record<Mode, Handlers> = {
    [Mode.NONE]: useNoneHandlers(handlerContext),
    [Mode.DRAW_JUNCTION]: useDrawNodeHandlers({
      ...handlerContext,
      nodeType: "junction",
    }),
    [Mode.DRAW_RESERVOIR]: useDrawNodeHandlers({
      ...handlerContext,
      nodeType: "reservoir",
    }),
    [Mode.DRAW_TANK]: useDrawNodeHandlers({
      ...handlerContext,
      nodeType: "tank",
    }),
    [Mode.DRAW_PIPE]: useDrawLinkHandlers({
      ...handlerContext,
      linkType: "pipe",
    }),
    [Mode.DRAW_PUMP]: useDrawLinkHandlers({
      ...handlerContext,
      linkType: "pump",
    }),
    [Mode.DRAW_VALVE]: useDrawLinkHandlers({
      ...handlerContext,
      linkType: "valve",
    }),
    [Mode.CONNECT_CUSTOMER_POINTS]:
      useConnectCustomerPointsHandlers(handlerContext),
    [Mode.REDRAW_LINK]: useRedrawLinkHandlers(handlerContext),
  };
  return HANDLERS;
}
