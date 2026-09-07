import { createStore } from "jotai";
import {
  registerTableHandleAtom,
  tableHandlesAtom,
  unregisterTableHandleAtom,
} from "./table-handles";

const aHandle = () => ({ captureState: vi.fn() });

describe("table handles", () => {
  it("makes a panel's handle reachable by its id", () => {
    const store = createStore();
    const handle = aHandle();

    store.set(registerTableHandleAtom, "junction", handle);
    store.get(tableHandlesAtom).junction?.captureState();

    expect(handle.captureState).toHaveBeenCalledTimes(1);
  });

  it("keeps each panel's handle apart", () => {
    const store = createStore();
    const junctions = aHandle();
    const pipes = aHandle();

    store.set(registerTableHandleAtom, "junction", junctions);
    store.set(registerTableHandleAtom, "pipe", pipes);
    store.get(tableHandlesAtom).junction?.captureState();

    expect(junctions.captureState).toHaveBeenCalledTimes(1);
    expect(pipes.captureState).not.toHaveBeenCalled();
  });

  it("drops the handle when the panel unregisters", () => {
    const store = createStore();
    const handle = aHandle();

    store.set(registerTableHandleAtom, "junction", handle);
    store.set(unregisterTableHandleAtom, "junction", handle);

    expect(store.get(tableHandlesAtom).junction).toBeUndefined();
  });

  it("leaves a remounted panel's handle in place when an older one unregisters", () => {
    const store = createStore();
    const stale = aHandle();
    const current = aHandle();

    store.set(registerTableHandleAtom, "junction", stale);
    store.set(registerTableHandleAtom, "junction", current);
    store.set(unregisterTableHandleAtom, "junction", stale);
    store.get(tableHandlesAtom).junction?.captureState();

    expect(current.captureState).toHaveBeenCalledTimes(1);
    expect(stale.captureState).not.toHaveBeenCalled();
  });
});
