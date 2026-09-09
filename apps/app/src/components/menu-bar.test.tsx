import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubLocale } from "src/__helpers__/locale";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { User } from "src/auth-types";
import { billingUrl } from "src/global-config";
import { useTranslate } from "src/hooks/use-translate";
import { dialogAtom } from "src/state/dialog";
import { TrialOrUpgradeButton } from "./menu-bar";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const inThreeDays = new Date(Date.now() + 3 * MS_PER_DAY).toISOString();

describe("trial or upgrade button", () => {
  beforeEach(() => {
    stubLocale("en");
    stubFeatureOn("FLAG_ACTIVATE_TRIAL");
  });

  it("counts the trial down and opens the billing portal", async () => {
    const open = stubOpen();
    const { store } = renderButton({
      user: aUser({
        hasUsedTrial: true,
        trialEndsAt: inThreeDays,
        subscriptionStatus: "trialing",
      }),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial: 3 days remaining" }),
    );

    expect(open).toHaveBeenCalledWith(
      `${billingUrl}/portal?locale=en`,
      "_blank",
      "noopener,noreferrer",
    );
    expect(store.get(dialogAtom)).toEqual({ type: "waitingForPayment" });
  });

  it("says the trial expired once stripe pauses it", async () => {
    const open = stubOpen();
    renderButton({ user: anEndedTrial() });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial expired" }),
    );

    expect(open).toHaveBeenCalledWith(
      `${billingUrl}/portal?locale=en`,
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("sends the language the app is being read in", async () => {
    stubLocale("es");
    const open = stubOpen();
    renderButton({ user: anEndedTrial() });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial expired" }),
    );

    expect(open).toHaveBeenCalledWith(
      `${billingUrl}/portal?locale=es`,
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("records which trial state sent them to the portal", async () => {
    stubOpen();
    const { userTracking } = renderButton({ user: anEndedTrial() });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial expired" }),
    );

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "billingPortal.opened",
      source: "menu",
      trial: "ended",
    });
  });

  it("does not open the plan cards for a trialist", async () => {
    stubOpen();
    const onUpgrade = vi.fn();
    renderButton({ user: anEndedTrial(), onUpgrade });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial expired" }),
    );

    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("keeps the plan cards for someone who never trialled", async () => {
    const open = stubOpen();
    const onUpgrade = vi.fn();
    renderButton({ onUpgrade });

    await userEvent.click(screen.getByRole("button", { name: "Upgrade" }));

    expect(onUpgrade).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("offers the plan cards to a cancelled trial, which has nothing to pay", async () => {
    const open = stubOpen();
    const onUpgrade = vi.fn();
    renderButton({
      user: anEndedTrial({ subscriptionStatus: "canceled" }),
      onUpgrade,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial expired" }),
    );

    expect(onUpgrade).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("shows the plain upgrade button when the trial flag is off", () => {
    renderButton({ user: anEndedTrial(), isActivateTrialOn: false });

    expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument();
    expect(screen.queryByText("Trial expired")).not.toBeInTheDocument();
  });

  it("shows nothing to someone who already pays", () => {
    const { container } = renderButton({
      user: aUser({ plan: "pro", hasUsedTrial: true }),
    });

    expect(container).toBeEmptyDOMElement();
  });

  const anEndedTrial = (attributes: Partial<User> = {}) =>
    aUser({
      hasUsedTrial: true,
      trialEndsAt: inThreeDays,
      subscriptionStatus: "paused",
      ...attributes,
    });

  const stubOpen = () =>
    vi.spyOn(window, "open").mockReturnValue(null as unknown as Window);

  const renderButton = ({
    user = aUser(),
    isActivateTrialOn = true,
    onUpgrade = vi.fn(),
  }: {
    user?: User;
    isActivateTrialOn?: boolean;
    onUpgrade?: () => void;
  } = {}) => {
    const store = createStore();
    const userTracking = stubUserTracking();

    const Subject = () => (
      <TrialOrUpgradeButton
        user={user}
        isActivateTrialOn={isActivateTrialOn}
        translate={useTranslate()}
        onUpgrade={onUpgrade}
      />
    );

    const { container } = render(
      <AuthMockProvider user={user}>
        <JotaiProvider store={store}>
          <Subject />
        </JotaiProvider>
      </AuthMockProvider>,
    );

    return { store, container, userTracking };
  };
});
