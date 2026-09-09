/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const tabStrip = (active: string, values: string[] = ["a", "b"]) => (
  <TabRoot value={active}>
    <TabList>
      {values.map((value) => (
        <Tab key={value} value={value}>
          {value.toUpperCase()}
        </Tab>
      ))}
    </TabList>
  </TabRoot>
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

// The list makes its active tab visible on mount, before a test has any say
// over the geometry: forget that first scroll to read the ones a test provokes.
const forgetScrolls = () => vi.mocked(tabList().scrollTo).mockClear();

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

  it("pages forward on the last tab shown whole, which leads the new page", async () => {
    stubMetrics({ scrollWidth: 400, clientWidth: 250 });

    render(tabStrip("a", ["a", "b", "c", "d"]));
    // Four 100px tabs in a 250px strip: A and B are whole, C is cut off.
    stubTabGeometry([100, 100, 100, 100], 250, 0);
    forgetScrolls();
    await userEvent.click(rightControl() as HTMLElement);

    expect(tabList().scrollTo).toHaveBeenCalledWith({
      left: 100,
      behavior: "smooth",
    });
  });

  it("pages back on the first tab shown whole, which trails the new page", async () => {
    stubMetrics({ scrollWidth: 400, clientWidth: 250 });

    render(tabStrip("a", ["a", "b", "c", "d"]));
    // Showing 150px in: A and B are behind, C and D are whole.
    stubTabGeometry([100, 100, 100, 100], 250, 150);
    fireEvent.scroll(tabList());
    forgetScrolls();
    await userEvent.click(leftControl() as HTMLElement);

    expect(tabList().scrollTo).toHaveBeenCalledWith({
      left: 50,
      behavior: "smooth",
    });
  });

  it("stops a page short of running past the end of the strip", async () => {
    stubMetrics({ scrollWidth: 400, clientWidth: 250 });

    render(tabStrip("a", ["a", "b", "c", "d"]));
    stubTabGeometry([100, 100, 100, 100], 250, 100);
    fireEvent.scroll(tabList());
    forgetScrolls();
    await userEvent.click(rightControl() as HTMLElement);

    expect(tabList().scrollTo).toHaveBeenCalledWith({
      left: 150,
      behavior: "smooth",
    });
  });

  it("scrolls a tab into view as it becomes the active one", async () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    const view = render(tabStrip("a"));
    // Two 120px tabs in a 200px strip: the second one is cut off by 40px.
    stubTabGeometry([120, 120], 200, 0);
    forgetScrolls();
    view.rerender(tabStrip("b"));

    await waitFor(() =>
      expect(tabList().scrollTo).toHaveBeenCalledWith({
        left: 40,
        behavior: "smooth",
      }),
    );
  });

  it("scrolls a tab into view as it joins the strip already active", async () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    const view = render(tabStrip("a"));
    forgetScrolls();
    view.rerender(tabStrip("c", ["a", "b", "c"]));
    stubTabGeometry([120, 120, 120], 200, 0);

    await waitFor(() =>
      expect(tabList().scrollTo).toHaveBeenCalledWith({
        left: 160,
        behavior: "smooth",
      }),
    );
  });

  it("leaves the strip where it is when a tab joins an untouched selection", async () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 200 });

    const view = render(tabStrip("a"));
    stubTabGeometry([120, 120], 200, 0);
    forgetScrolls();
    view.rerender(tabStrip("a", ["a", "b", "c"]));

    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    expect(tabList().scrollTo).not.toHaveBeenCalled();
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
