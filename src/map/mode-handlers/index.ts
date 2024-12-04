import type { HandlerContext } from "src/types";
import { Mode } from "src/state/jotai";
import { useNoneHandlers } from "./none";
import { useLassoHandlers } from "./lasso";
import { useJunctionHandlers } from "./junction";
import { useDrawPipeHandlers } from "./draw-pipe";
import { useDrawReservoirHandlers } from "./draw-reservoir";

export function useModeHandlers(handlerContext: HandlerContext) {
  const HANDLERS: Record<Mode, Handlers> = {
    [Mode.NONE]: useNoneHandlers(handlerContext),
    [Mode.DRAW_JUNCTION]: useJunctionHandlers(handlerContext),
    [Mode.DRAW_PIPE]: useDrawPipeHandlers(handlerContext),
    [Mode.DRAW_RESERVOIR]: useDrawReservoirHandlers(handlerContext),
    [Mode.LASSO]: useLassoHandlers(handlerContext),
  };
  return HANDLERS;
}
