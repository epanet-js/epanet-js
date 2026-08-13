import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import * as Tooltip from "@radix-ui/react-tooltip";
import { AuthMockProvider } from "src/__helpers__/auth-mock";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { billingUrl } from "src/global-config";
import { UpgradeDialog } from "./upgrade";

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn().mockResolvedValue({ redirectToCheckout: vi.fn() }),
}));

describe("upgrade dialog checkout", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    stubUserTracking();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  describe("FLAG_BILLING enabled", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_BILLING");
    });

    it("opens the billing app in a new tab", async () => {
      const open = stubOpen();
      stubNavigation();
      renderDialog();

      await userEvent.click(upgradeButtonFor("Pro"));

      expect(open).toHaveBeenCalledWith(
        `${billingUrl}/checkout?plan=pro&paymentType=yearly`,
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("keeps the current tab where it was", async () => {
      const open = stubOpen();
      const assign = stubNavigation();
      renderDialog();

      await userEvent.click(upgradeButtonFor("Pro"));

      expect(open).toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    });

    it("lets billing own the outcome pages", async () => {
      const open = stubOpen();
      stubNavigation();
      renderDialog();

      await userEvent.click(upgradeButtonFor("Pro"));

      const [target] = open.mock.calls[0];
      const params = new URL(target as string).searchParams;
      expect(params.get("successUrl")).toBeNull();
      expect(params.get("cancelUrl")).toBeNull();
    });

    it("sends the payment type chosen on the cards", async () => {
      const open = stubOpen();
      stubNavigation();
      renderDialog();

      await userEvent.click(screen.getByRole("switch"));
      await userEvent.click(upgradeButtonFor("Pro"));

      expect(open).toHaveBeenCalledWith(
        expect.stringContaining("plan=pro&paymentType=monthly"),
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("sends a signed-out user to the billing app without signing in first", async () => {
      const open = stubOpen();
      stubNavigation();
      renderDialog({ isSignedIn: false });

      await userEvent.click(upgradeButtonFor("Pro"));

      expect(open).toHaveBeenCalledWith(
        expect.stringContaining("/checkout?plan=pro&paymentType=yearly"),
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("does not start a checkout in the app", async () => {
      const fetchSpy = stubFetch();
      stubOpen();
      stubNavigation();
      renderDialog();

      await userEvent.click(upgradeButtonFor("Pro"));

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("FLAG_BILLING disabled", () => {
    beforeEach(() => {
      stubFeatureOff("FLAG_BILLING");
    });

    it("starts the checkout in the app", async () => {
      const fetchSpy = stubFetch();
      const assign = stubNavigation();
      renderDialog();

      await userEvent.click(upgradeButtonFor("Pro"));

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/stripe-checkout",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ plan: "pro", paymentType: "yearly" }),
        }),
      );
      expect(assign).not.toHaveBeenCalled();
    });
  });

  const upgradeButtonFor = (plan: string) =>
    screen.getByRole("button", { name: `Upgrade to ${plan}` });

  const stubNavigation = () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: "http://localhost:3000",
        href: "http://localhost:3000/",
        pathname: "/",
        search: "",
        assign,
      },
    });
    return assign;
  };

  const stubOpen = () =>
    vi.spyOn(window, "open").mockReturnValue(null as unknown as Window);

  const stubFetch = () =>
    vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ sessionId: "cs_test" })),
      );

  const renderDialog = ({ isSignedIn = true }: { isSignedIn?: boolean } = {}) =>
    render(
      <AuthMockProvider isSignedIn={isSignedIn}>
        <JotaiProvider store={createStore()}>
          <Tooltip.Provider>
            <UpgradeDialog />
          </Tooltip.Provider>
        </JotaiProvider>
      </AuthMockProvider>,
    );
});
