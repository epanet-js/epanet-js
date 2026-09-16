import { renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { initializeWorktree, type Branch } from "@epanet-js/worktree";
import { setInitialState } from "src/__helpers__/state";
import { worktreeAtom } from "src/state/scenarios";
import type { Store } from "src/state";
import { useIsMainLocked } from "./use-is-main-locked";

const SCENARIO: Branch = {
  id: "scenario-1",
  name: "Scenario #1",
  parentId: "main",
  status: "open",
};

const withAScenario = (activeBranchId: string): Store => {
  const store = setInitialState();
  const worktree = initializeWorktree();
  const main = worktree.branches.get(worktree.mainId)!;

  store.set(worktreeAtom, {
    ...worktree,
    activeBranchId,
    branches: new Map(worktree.branches)
      .set(worktree.mainId, { ...main, status: "locked" })
      .set(SCENARIO.id, SCENARIO),
    scenarios: [SCENARIO.id],
    highestScenarioNumber: 1,
  });
  return store;
};

const isMainLocked = (store: Store) =>
  renderHook(() => useIsMainLocked(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  }).result.current;

describe("useIsMainLocked", () => {
  it("is false on a fresh worktree with no scenarios", () => {
    expect(isMainLocked(setInitialState())).toBe(false);
  });

  it("is true while standing on main once a scenario exists", () => {
    expect(isMainLocked(withAScenario("main"))).toBe(true);
  });

  it("is true while standing on the scenario itself", () => {
    expect(isMainLocked(withAScenario(SCENARIO.id))).toBe(true);
  });
});
