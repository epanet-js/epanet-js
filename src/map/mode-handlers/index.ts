import type { HandlerContext } from "src/types";
import { Mode } from "src/state/jotai";
import { useNoneHandlers } from "./none";
import { useJunctionHandlers } from "./junction";
import { useDrawReservoirHandlers } from "./draw-reservoir";
import { useDrawLinkHandlers } from "./draw-link";

export function useModeHandlers(handlerContext: HandlerContext) {
  const HANDLERS: Record<Mode, Handlers> = {
    [Mode.NONE]: useNoneHandlers(handlerContext),
    [Mode.DRAW_JUNCTION]: useJunctionHandlers(handlerContext),
    [Mode.DRAW_RESERVOIR]: useDrawReservoirHandlers(handlerContext),
    [Mode.DRAW_PIPE]: useDrawLinkHandlers({
      ...handlerContext,
      linkType: "pipe",
    }),
    [Mode.DRAW_PUMP]: useDrawLinkHandlers({
      ...handlerContext,
      linkType: "pump",
    }),
  };
  return HANDLERS;
}
