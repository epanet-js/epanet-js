import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { recoverableSessionsAtom } from "src/state/session-recovery";
import type { RecoveryFingerprint } from "src/infra/session-recovery";
import { SessionRecoveryDialog } from "./session-recovery";

const recoverSession = vi.fn();
const discardSessions = vi.fn();
const ignoreSessions = vi.fn();

vi.mock("src/commands/recover-session", () => ({
  useRecoverSession: () => recoverSession,
  useDiscardRecoverableSession: () => discardSessions,
  useIgnoreRecoverableSessions: () => ignoreSessions,
}));

describe("session recovery dialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists the session when only one is recoverable", () => {
    renderDialog([aSession({ poolId: "pool-1", projectName: "my-model" })]);

    expect(screen.getByText(/1 session closed unexpectedly/i)).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(1);

    fireEvent.click(screen.getByRole("radio", { name: /my-model/ }));
    fireEvent.click(screen.getByRole("button", { name: "Recover selected" }));

    expect(recoverSession).toHaveBeenCalledWith(
      expect.objectContaining({ poolId: "pool-1" }),
    );
  });

  it("lists every session when multiple are recoverable", () => {
    renderDialog([
      aSession({ poolId: "pool-1", projectName: "oldest" }),
      aSession({ poolId: "pool-2", projectName: "newest" }),
      aSession({ poolId: "pool-3", projectName: "middle" }),
    ]);

    expect(screen.getByText(/3 sessions closed unexpectedly/i)).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("preselects the most recently changed session", () => {
    renderDialog([
      aSession({
        poolId: "pool-1",
        projectName: "older",
        timestampLastModelChange: 1000,
      }),
      aSession({
        poolId: "pool-2",
        projectName: "newer",
        timestampLastModelChange: 3000,
      }),
    ]);

    expect(screen.getByRole("radio", { name: /newer/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /older/ })).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Recover selected" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Recover selected" }));

    expect(recoverSession).toHaveBeenCalledWith(
      expect.objectContaining({ poolId: "pool-2" }),
    );
  });

  it("recovers the selected session", () => {
    renderDialog([
      aSession({ poolId: "pool-1", projectName: "one" }),
      aSession({ poolId: "pool-2", projectName: "two" }),
    ]);

    fireEvent.click(screen.getByRole("radio", { name: /two/ }));
    fireEvent.click(screen.getByRole("button", { name: "Recover selected" }));

    expect(recoverSession).toHaveBeenCalledWith(
      expect.objectContaining({ poolId: "pool-2" }),
    );
  });

  it("postpones or discards every session", () => {
    renderDialog([
      aSession({ poolId: "pool-1" }),
      aSession({ poolId: "pool-2" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(ignoreSessions).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Discard all" }));
    expect(discardSessions).toHaveBeenCalledTimes(1);
    expect(recoverSession).not.toHaveBeenCalled();
  });
});

const renderDialog = (sessions: RecoveryFingerprint[]) => {
  const store = createStore();
  store.set(recoverableSessionsAtom, sessions);

  render(
    <JotaiProvider store={store}>
      <SessionRecoveryDialog />
    </JotaiProvider>,
  );

  return store;
};

const aSession = (
  overrides: Partial<RecoveryFingerprint> = {},
): RecoveryFingerprint => ({
  poolId: "pool-1",
  projectName: "a-model",
  timestampLastModelChange: 1000,
  timestampLastSave: 500,
  ...overrides,
});
