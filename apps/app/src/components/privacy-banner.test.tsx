import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import i18n from "src/infra/i18n/i18next-config";
import { PrivacyBanner } from "./privacy-banner";

const key = "privacyBanner.productAnalyticsDescription";

describe("PrivacyBanner", () => {
  let original: string;

  beforeEach(() => {
    original = i18n.t(key);
  });

  afterEach(() => {
    i18n.addResource("en", "translation", key, original);
  });

  const openPreferences = async () => {
    const { container } = render(
      <JotaiProvider store={createStore()}>
        <PrivacyBanner />
      </JotaiProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Manage my preferences" }),
    );
    return container;
  };

  it("renders the bold part of the analytics description", async () => {
    await openPreferences();

    expect(screen.getByText("anonymous").tagName).toBe("STRONG");
  });

  it("does not render markup injected into a translation", async () => {
    i18n.addResource(
      "en",
      "translation",
      key,
      'Hello <img src="x" onerror="alert(1)" /> <strong>world</strong>',
    );

    const container = await openPreferences();

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("world").tagName).toBe("STRONG");
  });
});
