import { render, screen } from "@testing-library/react";
import toast from "react-hot-toast";
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
    toast.remove();
  });

  it("activates the trial without a word about the email", async () => {
    stubFeaturesOn(["FLAG_ACTIVATE_TRIAL"]);
    billingAnswers({ ok: true, status: 200 });
    const user = userEvent.setup();
    const store = setInitialState();
    store.set(dialogAtom, { type: "featurePaywall", feature: "pipeLibrary" });

    renderPaywall(store);
    await user.click(
      screen.getByRole("button", { name: "Activate free trial" }),
    );

    expect(
      await screen.findByText("Your trial is now active!"),
    ).toBeInTheDocument();
  });

  it("explains why an email cannot start a trial", async () => {
    stubFeaturesOn(["FLAG_ACTIVATE_TRIAL"]);
    billingRefuses("emailNotEligible");
    const user = userEvent.setup();
    const store = setInitialState();
    store.set(dialogAtom, { type: "featurePaywall", feature: "pipeLibrary" });

    renderPaywall(store);
    await user.click(
      screen.getByRole("button", { name: "Activate free trial" }),
    );

    expect(
      await screen.findByText("Free trial not available for this email"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Contact support/, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Your trial is now active!"),
    ).not.toBeInTheDocument();
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

const billingAnswers = (response: { ok: boolean; status: number }) => {
  global.fetch = vi.fn().mockResolvedValue({
    ...response,
    statusText: "",
    json: () => Promise.resolve({ status: "success" }),
  });
};

const billingRefuses = (reason: string) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    json: () => Promise.resolve({ reason }),
  });
};

const renderPaywall = (store: Store) => {
  render(
    <AuthMockProvider user={aUser({ plan: "free" })}>
      <CommandContainer store={store}>
        <div />
      </CommandContainer>
    </AuthMockProvider>,
  );
};
