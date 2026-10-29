import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { User } from "src/auth-types";
import { UpgradeDialog } from "./upgrade";

describe("upgrade dialog", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  it("shows the Teams plan when pricing upgrade is off", () => {
    stubFeatureOff("FLAG_PRICING_UPGRADE");

    renderDialog();

    expect(screen.getByRole("heading", { name: "Teams" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Ultimate" }),
    ).not.toBeInTheDocument();
  });

  describe("with pricing upgrade on", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_PRICING_UPGRADE");
    });

    it("shows Free, Pro and Ultimate without Teams or Enterprise", () => {
      renderDialog();

      expect(screen.getByRole("heading", { name: "Free" })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Pro" })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Ultimate" })).toBeVisible();
      expect(
        screen.queryByRole("heading", { name: "Teams" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Enterprise" }),
      ).not.toBeInTheDocument();
    });

    it("switches the Pro price with the billing period, without a discount", async () => {
      const user = userEvent.setup();
      renderDialog();

      expect(screen.getByText("$950")).toBeVisible();
      expect(screen.queryByText(/save/i)).not.toBeInTheDocument();

      await user.selectOptions(
        screen.getByLabelText("Billing period"),
        "monthly",
      );

      expect(screen.getByText("$250")).toBeVisible();
      expect(screen.queryByText("$950")).not.toBeInTheDocument();
    });

    it("links to the full pricing page", () => {
      renderDialog();

      expect(
        screen.getByRole("link", { name: "See all plans and features" }),
      ).toHaveAttribute("href", "https://epanetjs.com/pricing");
    });

    it("offers the trial only to users who have not used it", () => {
      renderDialog({ user: aUser({ hasUsedTrial: false }) });

      expect(
        screen.getByRole("button", { name: "Start free trial" }),
      ).toBeVisible();
    });

    it("switches to the non-commercial plans from the footer and back", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Non-commercial plans" }),
      );

      expect(screen.getByRole("heading", { name: "Personal" })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Education" })).toBeVisible();
      expect(
        screen.queryByRole("heading", { name: "Ultimate" }),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Back to commercial plans" }),
      );

      expect(screen.getByRole("heading", { name: "Ultimate" })).toBeVisible();
    });

    it("offers checkout once the trial is used", () => {
      renderDialog({ user: aUser({ hasUsedTrial: true }) });

      expect(
        screen.getByRole("button", { name: "Upgrade to Pro" }),
      ).toBeVisible();
    });
  });
});

const renderDialog = ({ user = aUser() }: { user?: User } = {}) => {
  const store = createStore();
  return render(
    <JotaiProvider store={store}>
      <AuthMockProvider user={user} isSignedIn={true}>
        <TooltipProvider>
          <UpgradeDialog />
        </TooltipProvider>
      </AuthMockProvider>
    </JotaiProvider>,
  );
};
