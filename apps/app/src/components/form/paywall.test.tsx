import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore, useAtomValue } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { PaywallLockButton, PaywallOverlay, useFeatureLock } from "./paywall";
import { dialogAtom } from "src/state/dialog";
import type { Permissions } from "src/hooks/use-permissions";

const defaultPermissions: Permissions = {
  canAddCustomLayers: false,
  canUseScenarios: false,
  canUseElevations: false,
  canUseZones: false,
  canUseControls: false,
  canUsePipeAttributes: false,
  canUseModelBuildV2: false,
  canValidateModelAttributes: false,
  canUpgrade: true,
  canManageOrganization: false,
};

const permissionsRef: { current: Permissions } = {
  current: defaultPermissions,
};

vi.mock("src/hooks/use-permissions", async () => {
  const actual = await vi.importActual<
    typeof import("src/hooks/use-permissions")
  >("src/hooks/use-permissions");
  return {
    ...actual,
    usePermissions: () => permissionsRef.current,
  };
});

vi.mock("src/hooks/use-translate", () => ({
  useTranslate: () => (key: string) => key,
}));

const Wrapper = ({
  store,
  children,
}: {
  store: ReturnType<typeof createStore>;
  children: React.ReactNode;
}) => (
  <JotaiProvider store={store}>
    <TooltipProvider>{children}</TooltipProvider>
  </JotaiProvider>
);

describe("useFeatureLock", () => {
  let userTracking: ReturnType<typeof stubUserTracking>;

  beforeEach(() => {
    permissionsRef.current = { ...defaultPermissions };
    userTracking = stubUserTracking();
  });

  const Probe = ({
    feature,
    onReady,
  }: {
    feature: "pipeAttributes" | "scenarios";
    onReady: (api: { isLocked: boolean; openPaywall: () => void }) => void;
  }) => {
    const api = useFeatureLock(feature);
    onReady(api);
    return null;
  };

  it("reports locked when the matching permission is false", () => {
    permissionsRef.current = {
      ...defaultPermissions,
      canUsePipeAttributes: false,
    };
    let captured: { isLocked: boolean } | null = null;
    const store = createStore();
    render(
      <Wrapper store={store}>
        <Probe feature="pipeAttributes" onReady={(api) => (captured = api)} />
      </Wrapper>,
    );
    expect(captured!.isLocked).toBe(true);
  });

  it("reports unlocked when the matching permission is true", () => {
    permissionsRef.current = {
      ...defaultPermissions,
      canUsePipeAttributes: true,
    };
    let captured: { isLocked: boolean } | null = null;
    const store = createStore();
    render(
      <Wrapper store={store}>
        <Probe feature="pipeAttributes" onReady={(api) => (captured = api)} />
      </Wrapper>,
    );
    expect(captured!.isLocked).toBe(false);
  });

  it("openPaywall for pipeAttributes opens the upgrade dialog with a paywall source", () => {
    let captured: { openPaywall: () => void } | null = null;
    const store = createStore();
    render(
      <Wrapper store={store}>
        <Probe feature="pipeAttributes" onReady={(api) => (captured = api)} />
      </Wrapper>,
    );
    act(() => {
      captured!.openPaywall();
    });
    expect(store.get(dialogAtom)).toEqual({
      type: "upgrade",
      source: { kind: "paywall", feature: "pipeAttributes" },
    });
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "paywallLock.clicked",
      feature: "pipeAttributes",
    });
  });

  it("openPaywall for scenarios opens the featurePaywall dialog", () => {
    let captured: { openPaywall: () => void } | null = null;
    const store = createStore();
    render(
      <Wrapper store={store}>
        <Probe feature="scenarios" onReady={(api) => (captured = api)} />
      </Wrapper>,
    );
    act(() => {
      captured!.openPaywall();
    });
    expect(store.get(dialogAtom)).toEqual({
      type: "featurePaywall",
      feature: "scenarios",
    });
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "paywallLock.clicked",
      feature: "scenarios",
    });
  });
});

describe("PaywallLockButton", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  it("opens the upgrade dialog on click for pipeAttributes", async () => {
    const user = userEvent.setup();
    const store = createStore();
    render(
      <Wrapper store={store}>
        <PaywallLockButton feature="pipeAttributes" label="Material" />
      </Wrapper>,
    );
    await user.click(
      screen.getByRole("button", { name: /paywall.tooltip: Material/i }),
    );
    expect(store.get(dialogAtom)).toEqual({
      type: "upgrade",
      source: { kind: "paywall", feature: "pipeAttributes" },
    });
  });
});

describe("PaywallOverlay", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  it("clicking the overlay opens the paywall and the inner control does not receive the click", async () => {
    const user = userEvent.setup();
    const store = createStore();
    const innerClick = vi.fn();

    const DialogProbe = () => {
      const dialog = useAtomValue(dialogAtom);
      return <span data-testid="dialog">{dialog ? dialog.type : "none"}</span>;
    };

    render(
      <Wrapper store={store}>
        <PaywallOverlay feature="pipeAttributes" ariaLabel="Year">
          <button onClick={innerClick}>inner</button>
        </PaywallOverlay>
        <DialogProbe />
      </Wrapper>,
    );

    await user.click(
      screen.getByRole("button", { name: /paywall.tooltip: Year/i }),
    );
    expect(innerClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("dialog").textContent).toBe("upgrade");
  });
});
