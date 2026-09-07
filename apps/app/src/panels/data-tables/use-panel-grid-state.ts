import { useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";
import type { PanelType } from "src/panels/panel";
import {
  type PanelContentStateByType,
  contentStateFor,
  withContentState,
} from "src/panels/panel-template";
import { panelContentStateAtom } from "src/state/panels";

export const usePanelGridState = <T extends PanelType>(
  panelId: string,
  panelType: T,
): [
  PanelContentStateByType[T] | undefined,
  (state: PanelContentStateByType[T]) => void,
] => {
  const store = useStore();
  const setStates = useSetAtom(panelContentStateAtom);

  const restored = useRef<PanelContentStateByType[T] | undefined>();
  const hasRead = useRef(false);
  if (!hasRead.current) {
    hasRead.current = true;
    restored.current = contentStateFor(
      store.get(panelContentStateAtom),
      panelId,
      panelType,
    );
  }

  const save = useCallback(
    (state: PanelContentStateByType[T]) => {
      setStates((prev) => withContentState(prev, panelId, panelType, state));
    },
    [setStates, panelId, panelType],
  );

  return [restored.current, save];
};
