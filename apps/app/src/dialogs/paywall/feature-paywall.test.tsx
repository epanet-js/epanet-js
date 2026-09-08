import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { stubFeaturesOn } from "src/__helpers__/feature-flags";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { dialogAtom } from "src/state/dialog";
import { Store } from "src/state";

describe("featurePaywall", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  it("shows the plans when exploring them from the trial screen", async () => {
    stubFeaturesOn(["FLAG_ACTIVATE_TRIAL"]);
    const user = userEvent.setup();
    const store = setInitialState();
    store.set(dialogAtom, { type: "featurePaywall", feature: "pipeLibrary" });

    renderPaywall(store);

    expect(
      screen.getByRole("button", { name: "Activate free trial" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Explore plans" }));

    expect(screen.getByText("Non-commercial use")).toBeInTheDocument();
    expect(screen.getByText("Commercial use")).toBeInTheDocument();
  });

  it("goes back to the trial screen from the plans", async () => {
    stubFeaturesOn(["FLAG_ACTIVATE_TRIAL"]);
    const user = userEvent.setup();
    const store = setInitialState();
    store.set(dialogAtom, { type: "featurePaywall", feature: "pipeLibrary" });

    renderPaywall(store);
    await user.click(screen.getByRole("button", { name: "Explore plans" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(
      screen.getByRole("button", { name: "Activate free trial" }),
    ).toBeInTheDocument();
  });

  it("shows the plans when the user is not eligible for a trial", async () => {
    stubFeaturesOn([]);
    const user = userEvent.setup();
    const store = setInitialState();
    store.set(dialogAtom, { type: "featurePaywall", feature: "pipeLibrary" });

    renderPaywall(store);

    expect(
      screen.queryByRole("button", { name: "Activate free trial" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Explore plans" }));

    expect(screen.getByText("Non-commercial use")).toBeInTheDocument();
  });
});

const renderPaywall = (store: Store) => {
  render(
    <AuthMockProvider user={aUser({ plan: "free" })}>
      <CommandContainer store={store}>
        <div />
      </CommandContainer>
    </AuthMockProvider>,
  );
};
