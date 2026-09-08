/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "src/__helpers__/locale";
import { Tab, TabList, TabRoot } from "./tab";

const stubMetrics = ({
  scrollWidth,
  clientWidth,
}: {
  scrollWidth: number;
  clientWidth: number;
}) => {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => scrollWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => clientWidth,
  });
};

const renderTabs = () =>
  render(
    <TabRoot value="a">
      <TabList>
        <Tab value="a">Junctions</Tab>
        <Tab value="b">Pipes</Tab>
      </TabList>
    </TabRoot>,
  );

const tabList = () => screen.getByRole("tablist");
const leftControl = () =>
  screen.queryByRole("button", { name: "Scroll tabs left" });
const rightControl = () =>
  screen.queryByRole("button", { name: "Scroll tabs right" });

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
    configurable: true,
    writable: true,
    value: 0,
  });
  HTMLElement.prototype.scrollBy = vi.fn();
});

afterEach(() => {
  stubMetrics({ scrollWidth: 0, clientWidth: 0 });
});

describe("Tab", () => {
  it("keeps a long label on one line and lets the tab grow", () => {
    renderTabs();

    const tab = screen.getByRole("tab", { name: "Junctions" });
    expect(tab).toHaveClass("whitespace-nowrap", "shrink-0");
  });
});

describe("TabList", () => {
  it("registers the scroll timeline the edge shadows animate on", () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();

    expect(tabList()).toHaveClass("scroll-shadows-x-inner");
    expect(tabList()).toHaveClass("overscroll-x-none");
    expect(tabList().parentElement).toHaveClass("scroll-shadows-x");
  });

  it("offers no scroll controls while every tab fits", () => {
    stubMetrics({ scrollWidth: 200, clientWidth: 200 });

    renderTabs();

    expect(leftControl()).not.toBeInTheDocument();
    expect(rightControl()).not.toBeInTheDocument();
  });

  it("shows both controls as soon as the tabs overflow", () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();

    expect(leftControl()).toBeInTheDocument();
    expect(rightControl()).toBeInTheDocument();
  });

  it("disables the control that has nowhere to go", () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();

    expect(leftControl()).toBeDisabled();
    expect(rightControl()).toBeEnabled();
  });

  it("enables both controls in the middle of the strip", () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();
    tabList().scrollLeft = 120;
    fireEvent.scroll(tabList());

    expect(leftControl()).toBeEnabled();
    expect(rightControl()).toBeEnabled();
  });

  it("keeps the forward control in place at the end of the strip", () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();
    tabList().scrollLeft = 400;
    fireEvent.scroll(tabList());

    expect(rightControl()).toBeInTheDocument();
    expect(rightControl()).toBeDisabled();
    expect(leftControl()).toBeEnabled();
  });

  it("scrolls the strip when a control is pressed", async () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();
    await userEvent.click(rightControl() as HTMLElement);

    expect(tabList().scrollBy).toHaveBeenCalledWith({ left: 160 });
  });

  it("turns a vertical wheel into a horizontal scroll", () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();
    fireEvent.wheel(tabList(), { deltaY: 80 });

    expect(tabList().scrollLeft).toEqual(80);
  });

  it("leaves the wheel alone when everything fits", () => {
    stubMetrics({ scrollWidth: 200, clientWidth: 200 });

    renderTabs();
    fireEvent.wheel(tabList(), { deltaY: 80 });

    expect(tabList().scrollLeft).toEqual(0);
  });
});
