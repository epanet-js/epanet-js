/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "src/__helpers__/locale";
import { Tab, TabList, TabRoot, scrollTargetFor } from "./tab";

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

const stubTabGeometry = (
  widths: number[],
  listWidth: number,
  scrollLeft: number,
) => {
  const list = tabList();
  list.scrollLeft = scrollLeft;
  vi.spyOn(list, "getBoundingClientRect").mockReturnValue({
    left: 0,
    width: listWidth,
  } as DOMRect);
  Array.from(list.children).forEach((tab, index) => {
    const start = widths.slice(0, index).reduce((total, w) => total + w, 0);
    vi.spyOn(tab, "getBoundingClientRect").mockReturnValue({
      left: start - scrollLeft,
      width: widths[index],
    } as DOMRect);
  });
};

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
    configurable: true,
    writable: true,
    value: 0,
  });
  HTMLElement.prototype.scrollBy = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  stubMetrics({ scrollWidth: 0, clientWidth: 0 });
});

describe("scrollTargetFor", () => {
  const tabs = [
    { start: 0, end: 100 },
    { start: 100, end: 220 },
    { start: 220, end: 300 },
  ];

  it("aligns the next cut-off tab with the far edge", () => {
    expect(scrollTargetFor(tabs, 0, 200, 1)).toEqual(20);
  });

  it("advances one tab at a time, not one viewport", () => {
    expect(scrollTargetFor(tabs, 20, 200, 1)).toEqual(100);
  });

  it("stays put when the last tab is already whole", () => {
    expect(scrollTargetFor(tabs, 100, 200, 1)).toEqual(100);
  });

  it("brings the tab cut off at the start flush to the left", () => {
    expect(scrollTargetFor(tabs, 150, 200, -1)).toEqual(100);
  });

  it("steps back one tab rather than one viewport", () => {
    expect(scrollTargetFor(tabs, 100, 200, -1)).toEqual(0);
  });

  it("stays put at the beginning of the strip", () => {
    expect(scrollTargetFor(tabs, 0, 200, -1)).toEqual(0);
  });

  it("ignores a sub-pixel sliver at the edge", () => {
    expect(scrollTargetFor(tabs, 100.5, 200, -1)).toEqual(0);
  });
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

  it("brings the next cut-off tab fully into view", async () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    renderTabs();
    // Two 120px tabs in a 200px strip: the second is cut off by 40px.
    stubTabGeometry([120, 120], 200, 0);
    await userEvent.click(rightControl() as HTMLElement);

    expect(tabList().scrollTo).toHaveBeenCalledWith({
      left: 40,
      behavior: "smooth",
    });
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
