import type { HandlerContext } from "src/types";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useNoneHandlers as useNoneHandlersNew } from "./none-handlers";
import { useNoneHandlersDeprecated } from "./none-handlers-deprecated";

export function useNoneHandlers(handlerContext: HandlerContext): Handlers {
  const isSnappingOn = useFeatureFlag("FLAG_SNAPPING");

  const newHandlers = useNoneHandlersNew(handlerContext);
  const deprecatedHandlers = useNoneHandlersDeprecated(handlerContext);

  return isSnappingOn ? newHandlers : deprecatedHandlers;
}
