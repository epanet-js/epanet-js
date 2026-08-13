import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { Plan } from "src/lib/account-plans";
import { dialogAtom } from "src/state/dialog";

vi.mock("src/components/notifications", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("src/components/notifications")>();
  return { ...original, notify: vi.fn() };
});

import { Dialogs } from "src/dialogs";
import { notify } from "src/components/notifications";

const POLL_INTERVAL_MS = 3000;
const POLL_WINDOW_MS = 5 * 60 * 1000;

describe("waiting for payment dialog", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_BILLING");
    vi.mocked(notify).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reloads the user every three seconds", () => {
    const { reload } = renderDialog();

    advanceBy(POLL_INTERVAL_MS);
    expect(reload).toHaveBeenCalledTimes(1);

    advanceBy(POLL_INTERVAL_MS);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("stops reloading after five minutes", () => {
    const { reload } = renderDialog();

    elapseWindow();
    const callsWithinWindow = reload.mock.calls.length;

    advanceBy(POLL_WINDOW_MS);

    expect(reload).toHaveBeenCalledTimes(callsWithinWindow);
  });

  it("polls again when the tab becomes visible after the window elapsed", () => {
    const { reload } = renderDialog();

    elapseWindow();
    const callsWithinWindow = reload.mock.calls.length;

    activateTab();
    advanceBy(POLL_INTERVAL_MS);

    expect(reload).toHaveBeenCalledTimes(callsWithinWindow + 1);
  });

  it("keeps a single poll running when the tab is activated while polling", () => {
    const { reload } = renderDialog();

    advanceBy(POLL_INTERVAL_MS);
    activateTab();
    advanceBy(POLL_INTERVAL_MS);

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("closes and notifies when the plan changes", () => {
    const { store, completePayment } = renderDialog();

    completePayment();

    expect(store.get(dialogAtom)).toBeNull();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("stops polling when the user cancels", () => {
    const { store, reload } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(store.get(dialogAtom)).toBeNull();

    advanceBy(POLL_INTERVAL_MS);

    expect(reload).not.toHaveBeenCalled();
  });

  const elapseWindow = () => advanceBy(POLL_WINDOW_MS + POLL_INTERVAL_MS);

  const advanceBy = (milliseconds: number) => {
    act(() => {
      vi.advanceTimersByTime(milliseconds);
    });
  };

  const activateTab = () => {
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  };

  const renderDialog = () => {
    const store = createStore();
    store.set(dialogAtom, { type: "waitingForPayment" });
    const reload = vi.fn().mockResolvedValue(undefined);

    let upgradePlan: (plan: Plan) => void = () => {};

    const Harness = () => {
      const [plan, setPlan] = useState<Plan>("free");
      upgradePlan = setPlan;

      return (
        <AuthMockProvider user={aUser({ plan })} reload={reload}>
          <JotaiProvider store={store}>
            <Dialogs />
          </JotaiProvider>
        </AuthMockProvider>
      );
    };

    render(<Harness />);

    return {
      store,
      reload,
      completePayment: () => act(() => upgradePlan("pro")),
    };
  };
});
