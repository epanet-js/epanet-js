/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { Provider } from "jotai";
import { createStore } from "jotai";
import { panelContentStateAtom } from "src/state/panels";
import { usePanelGridState } from "./use-panel-grid-state";

const renderFor = (store: ReturnType<typeof createStore>, panelId: string) =>
  renderHook(() => usePanelGridState(panelId, "asset-table"), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });

describe("usePanelGridState", () => {
  it("stores what a panel saves under its own id", () => {
    const store = createStore();
    const { result } = renderFor(store, "junction");

    act(() => result.current[1]({ scrollTop: 120 }));

    expect(store.get(panelContentStateAtom)).toEqual({
      junction: { scrollTop: 120 },
    });
  });

  it("hands back what the panel saved when it mounts again", () => {
    const store = createStore();
    const first = renderFor(store, "junction");
    act(() => first.result.current[1]({ scrollTop: 120 }));
    first.unmount();

    const second = renderFor(store, "junction");

    expect(second.result.current[0]).toEqual({ scrollTop: 120 });
  });

  it("keeps each panel's state apart", () => {
    const store = createStore();
    const junctions = renderFor(store, "junction");
    const pipes = renderFor(store, "pipe");

    act(() => junctions.result.current[1]({ scrollTop: 10 }));
    act(() => pipes.result.current[1]({ scrollTop: 99 }));

    expect(store.get(panelContentStateAtom)).toEqual({
      junction: { scrollTop: 10 },
      pipe: { scrollTop: 99 },
    });
  });

  it("reads the state it mounted with, ignoring later writes", () => {
    const store = createStore();
    store.set(panelContentStateAtom, { junction: { scrollTop: 5 } });
    const { result } = renderFor(store, "junction");

    act(() => {
      store.set(panelContentStateAtom, { junction: { scrollTop: 999 } });
    });

    expect(result.current[0]).toEqual({ scrollTop: 5 });
  });

  it("keeps writing under the panel id it mounted with", () => {
    const store = createStore();
    const { result } = renderFor(store, "junction");

    act(() => result.current[1]({ scrollTop: 12 }));
    act(() => result.current[1]({ scrollTop: 34 }));

    expect(store.get(panelContentStateAtom)).toEqual({
      junction: { scrollTop: 34 },
    });
  });
});
