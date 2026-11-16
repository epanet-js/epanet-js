import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { stubLocale } from "src/__helpers__/locale";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { User } from "src/auth-types";
import { useTranslate } from "src/hooks/use-translate";
import { TrialOrUpgradeButton } from "./menu-bar";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const inThreeDays = new Date(Date.now() + 3 * MS_PER_DAY).toISOString();

describe("trial or upgrade button", () => {
  beforeEach(() => {
    stubLocale("en");
  });

  it("counts the trial down and opens the plan cards", async () => {
    const open = stubOpen();
    const onUpgrade = vi.fn();
    renderButton({
      user: aUser({
        hasUsedTrial: true,
        trialEndsAt: inThreeDays,
        subscriptionStatus: "trialing",
      }),
      onUpgrade,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial: 3 days remaining" }),
    );

    expect(onUpgrade).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("says the trial expired and opens the plan cards", async () => {
    const open = stubOpen();
    const onUpgrade = vi.fn();
    renderButton({ user: anEndedTrial(), onUpgrade });

    await userEvent.click(
      screen.getByRole("button", { name: "Trial expired" }),
    );

    expect(onUpgrade).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps the plan cards for someone who never trialled", async () => {
    const open = stubOpen();
    const onUpgrade = vi.fn();
    renderButton({ onUpgrade });

    await userEvent.click(screen.getByRole("button", { name: "Upgrade" }));

    expect(onUpgrade).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("offers the plan cards to a cancelled subscription", async () => {
    const open = stubOpen();
    const onUpgrade = vi.fn();
    renderButton({
      user: anEndedTrial({ subscriptionStatus: "canceled" }),
      onUpgrade,
    });

    expect(screen.queryByText("Trial expired")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Upgrade" }));

    expect(onUpgrade).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
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
    onUpgrade = vi.fn(),
  }: {
    user?: User;
    onUpgrade?: () => void;
  } = {}) => {
    const store = createStore();
    stubUserTracking();

    const Subject = () => (
      <TrialOrUpgradeButton
        user={user}
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

    return { container };
  };
});
