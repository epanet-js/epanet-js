import { atom } from "jotai";

export type TableHandle = { captureState: () => void };

export const tableHandlesAtom = atom<Record<string, TableHandle>>({});

export const registerTableHandleAtom = atom(
  null,
  (_get, set, panelId: string, handle: TableHandle) => {
    set(tableHandlesAtom, (prev) => ({ ...prev, [panelId]: handle }));
  },
);

export const unregisterTableHandleAtom = atom(
  null,
  (get, set, panelId: string, handle: TableHandle) => {
    if (get(tableHandlesAtom)[panelId] !== handle) return;
    set(tableHandlesAtom, (prev) => {
      const next = { ...prev };
      delete next[panelId];
      return next;
    });
  },
);
