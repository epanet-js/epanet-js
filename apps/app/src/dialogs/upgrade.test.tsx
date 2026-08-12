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

    it("sends the user to the billing app", async () => {
      const assign = stubNavigation();
      renderDialog();

      await userEvent.click(upgradeButtonFor("Pro"));

      expect(assign).toHaveBeenCalledWith(
        `${billingUrl}/checkout?plan=pro&paymentType=yearly&return=http%3A%2F%2Flocalhost%3A3000%2F`,
      );
    });

    it("sends the payment type chosen on the cards", async () => {
      const assign = stubNavigation();
      renderDialog();

      await userEvent.click(screen.getByRole("switch"));
      await userEvent.click(upgradeButtonFor("Pro"));

      expect(assign).toHaveBeenCalledWith(
        expect.stringContaining("plan=pro&paymentType=monthly"),
      );
    });

    it("sends a signed-out user to the billing app without signing in first", async () => {
      const assign = stubNavigation();
      renderDialog({ isSignedIn: false });

      await userEvent.click(upgradeButtonFor("Pro"));

      expect(assign).toHaveBeenCalledWith(
        expect.stringContaining("/checkout?plan=pro&paymentType=yearly"),
      );
    });

    it("does not start a checkout in the app", async () => {
      const fetchSpy = stubFetch();
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
