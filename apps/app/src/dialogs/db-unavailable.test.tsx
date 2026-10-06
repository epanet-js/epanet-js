import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { initializeWorktree, type Branch } from "@epanet-js/worktree";
import { worktreeAtom } from "src/state/scenarios";
import { DbUnavailableDialog } from "./db-unavailable";

vi.mock("src/hooks/persistence/use-rebuild-db", () => ({
  useRebuildDb: () => vi.fn(),
}));

describe("db unavailable dialog", () => {
  it("offers to try again when there are no scenarios", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  it("only offers a reload while scenarios exist", () => {
    renderDialog({ withScenario: true });

    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
    expect(screen.getByText(/last saved project file/i)).toBeVisible();
  });
});

const renderDialog = ({ withScenario = false } = {}) => {
  const store = createStore();
  if (withScenario) {
    const worktree = initializeWorktree();
    const main = worktree.branches.get(worktree.mainId)!;
    const scenario: Branch = {
      id: "scenario-1",
      name: "Scenario #1",
      parentId: worktree.mainId,
      status: "open",
    };
    store.set(worktreeAtom, {
      ...worktree,
      branches: new Map(worktree.branches)
        .set(worktree.mainId, { ...main, status: "locked" })
        .set(scenario.id, scenario),
      scenarios: [scenario.id],
      highestScenarioNumber: 1,
    });
  }

  render(
    <JotaiProvider store={store}>
      <DbUnavailableDialog />
    </JotaiProvider>,
  );
};
