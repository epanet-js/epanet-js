import { render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { ModelBuilderPaywallDialog } from "./model-builder-paywall";

describe("model builder paywall dialog", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  it("keeps the current feature lists when the flag is off", () => {
    stubFeatureOff("FLAG_MODEL_BUILDER_PAYWALL");

    renderDialog();

    expect(screen.getAllByText("Filter data")).toHaveLength(2);
    expect(screen.queryByText("Zones")).not.toBeInTheDocument();
    expect(screen.queryByText("Pro plans and above")).not.toBeInTheDocument();
  });

  it("shows the updated feature lists when the flag is on", () => {
    stubFeatureOn("FLAG_MODEL_BUILDER_PAYWALL");

    renderDialog();

    expect(screen.getAllByText("Zones")).toHaveLength(2);
    expect(screen.getAllByText("DXF and CSV files")).toHaveLength(2);
    expect(screen.getAllByText("Save build settings")).toHaveLength(1);
    expect(screen.queryByText("Not available:")).not.toBeInTheDocument();
    expect(screen.queryByText("Filter data")).not.toBeInTheDocument();
    expect(screen.getByText("Free and Personal plans")).toBeVisible();
    expect(screen.getByText("Pro plans and above")).toBeVisible();
  });
});

const renderDialog = () => {
  const store = createStore();
  return render(
    <JotaiProvider store={store}>
      <AuthMockProvider user={aUser()} isSignedIn={true}>
        <TooltipProvider>
          <ModelBuilderPaywallDialog source="test" onClose={() => {}} />
        </TooltipProvider>
      </AuthMockProvider>
    </JotaiProvider>,
  );
};
