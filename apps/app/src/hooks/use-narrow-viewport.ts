import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { isNarrowViewportAtom } from "src/state/layout";
import { useBreakpoint } from "./use-breakpoint";

export const useNarrowViewport = (): boolean => {
  const isNarrow = !useBreakpoint("sm");
  const setIsNarrowViewport = useSetAtom(isNarrowViewportAtom);

  useHydrateAtoms([[isNarrowViewportAtom, isNarrow]] as const);

  useEffect(() => {
    setIsNarrowViewport(isNarrow);
  }, [isNarrow, setIsNarrowViewport]);

  return isNarrow;
};
