import type { HandlerContext } from "src/types";
import { Mode } from "src/state/jotai";
import { useNoneHandlers } from "src/lib/handlers/none";
import { useLassoHandlers } from "src/lib/handlers/lasso";
import { useRectangleHandlers } from "src/lib/handlers/rectangle";
import { useCircleHandlers } from "src/lib/handlers/circle";
import { useLineHandlers } from "src/lib/handlers/line";
import { useJunctionHandlers } from "src/lib/handlers/junction";
import { usePolygonHandlers } from "src/lib/handlers/polygon";
import { useDrawPipeHandlers } from "./draw-pipe";

export function useHandlers(handlerContext: HandlerContext) {
  const HANDLERS: Record<Mode, Handlers> = {
    [Mode.NONE]: useNoneHandlers(handlerContext),
    [Mode.DRAW_JUNCTION]: useJunctionHandlers(handlerContext),
    [Mode.DRAW_PIPE]: useDrawPipeHandlers(handlerContext),
    [Mode.DRAW_LINE]: useLineHandlers(handlerContext),
    [Mode.DRAW_POLYGON]: usePolygonHandlers(handlerContext),
    [Mode.DRAW_RECTANGLE]: useRectangleHandlers(handlerContext),
    [Mode.DRAW_CIRCLE]: useCircleHandlers(handlerContext),
    [Mode.LASSO]: useLassoHandlers(handlerContext),
  };
  return HANDLERS;
}
