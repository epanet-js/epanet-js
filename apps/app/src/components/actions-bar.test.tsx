/** @vitest-environment jsdom */
import * as Tooltip from "@radix-ui/react-tooltip";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "src/__helpers__/locale";
import { Action } from "./action-button";
import { ActionsBar, actionsThatFit } from "./actions-bar";

describe("actionsThatFit", () => {
  const buttons = [32, 32, 32, 32, 32, 32];
  const moreButton = 32;
  const gap = 4;

  it("keeps every action when the whole row fits", () => {
    expect(actionsThatFit(buttons, moreButton, gap, 500)).toEqual(6);
  });

  it("keeps every action when the row fits exactly", () => {
    expect(actionsThatFit(buttons, moreButton, gap, 212)).toEqual(6);
  });

  it("leaves room for the more button when the row does not fit", () => {
    expect(actionsThatFit(buttons, moreButton, gap, 200)).toEqual(4);
  });

  it("collapses every action when not even one fits beside it", () => {
    expect(actionsThatFit(buttons, moreButton, gap, 40)).toEqual(0);
  });

  it("measures each action separately", () => {
    expect(actionsThatFit([100, 32, 32], moreButton, gap, 120)).toEqual(0);
    expect(actionsThatFit([32, 100, 32], moreButton, gap, 120)).toEqual(1);
  });
});

describe("ActionsBar", () => {
  it("shows every action when they all fit", () => {
    renderHeader(500);

    expect(button("Zoom to")).toBeInTheDocument();
    expect(button("Reverse")).toBeInTheDocument();
    expect(button("Redraw")).toBeInTheDocument();
    expect(button("Delete")).toBeInTheDocument();
    expect(moreActions()).not.toBeInTheDocument();
  });

  it("moves the least used actions into the more actions menu", async () => {
    const user = userEvent.setup();
    renderHeader(100);

    expect(button("Redraw")).toBeInTheDocument();
    expect(button("Delete")).toBeInTheDocument();
    expect(button("Zoom to")).not.toBeInTheDocument();
    expect(button("Reverse")).not.toBeInTheDocument();

    await user.click(moreActions() as HTMLElement);

    expect(screen.getByRole("menuitem", { name: "Zoom to" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Reverse" })).toBeVisible();
  });

  it("keeps the actions it shows in their declared order", () => {
    renderHeader(100);

    const labels = screen
      .getAllByRole("button")
      .map((each) => each.getAttribute("aria-label"));

    expect(labels).toEqual(["Redraw", "Delete", "More actions"]);
  });

  it("keeps three buttons on screen however narrow the header is", () => {
    renderHeader(40);

    expect(button("Redraw")).toBeInTheDocument();
    expect(button("Delete")).toBeInTheDocument();
    expect(button("Zoom to")).not.toBeInTheDocument();
    expect(moreActions()).toBeInTheDocument();
  });

  it("spends the floor on actions when none of them overflow", () => {
    renderHeader(40, { only: ["Reverse", "Redraw", "Delete"] });

    expect(button("Reverse")).toBeInTheDocument();
    expect(button("Redraw")).toBeInTheDocument();
    expect(button("Delete")).toBeInTheDocument();
    expect(moreActions()).not.toBeInTheDocument();
  });

  it("hides an action with no usage ranking before any ranked one", async () => {
    const user = userEvent.setup();
    renderHeader(100, { extra: "Save selection set" });

    expect(button("Save selection set")).not.toBeInTheDocument();

    await user.click(moreActions() as HTMLElement);

    expect(
      screen.getByRole("menuitem", { name: "Save selection set" }),
    ).toBeVisible();
  });

  it("runs an action selected from the more actions menu", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    renderHeader(100, { onZoomTo: onSelect });

    await user.click(moreActions() as HTMLElement);
    await user.click(screen.getByRole("menuitem", { name: "Zoom to" }));

    expect(onSelect).toHaveBeenCalled();
  });

  it("leaves the title the floor it declares", () => {
    renderHeader(200, { titleFloor: 100 });

    expect(button("Redraw")).toBeInTheDocument();
    expect(button("Reverse")).not.toBeInTheDocument();
    expect(moreActions()).toBeInTheDocument();
  });

  it("leaves a title that cannot shrink the width it takes", () => {
    renderHeader(200, { titleWidth: 100 });

    expect(button("Redraw")).toBeInTheDocument();
    expect(button("Reverse")).not.toBeInTheDocument();
    expect(moreActions()).toBeInTheDocument();
  });

  it("takes the whole header when the title reserves nothing", () => {
    renderHeader(200);

    expect(button("Delete")).toBeInTheDocument();
    expect(moreActions()).not.toBeInTheDocument();
  });

  it("gives the actions back when the header grows", () => {
    renderHeader(100);

    expect(button("Zoom to")).not.toBeInTheDocument();

    stubWidths(500);
    layOut();

    expect(button("Zoom to")).toBeInTheDocument();
    expect(moreActions()).not.toBeInTheDocument();
  });
});

const BUTTON_WIDTH = 32;

const priorities: Record<string, number> = {
  Delete: 1,
  Redraw: 2,
  Reverse: 3,
  "Zoom to": 4,
};

const buildActions = (onZoomTo: () => Promise<void>): Action[] =>
  ["Zoom to", "Reverse", "Redraw", "Delete"].map((label) => ({
    label,
    applicable: true,
    priority: priorities[label],
    icon: <svg />,
    onSelect: label === "Zoom to" ? onZoomTo : () => Promise.resolve(),
  }));

const renderHeader = (
  headerWidth: number,
  {
    titleFloor = 0,
    titleWidth = 0,
    onZoomTo = () => Promise.resolve(),
    extra,
    only,
  }: {
    titleFloor?: number;
    titleWidth?: number;
    onZoomTo?: () => Promise<void>;
    extra?: string;
    only?: string[];
  } = {},
) => {
  const actions = buildActions(onZoomTo).filter(
    (action) => !only || only.includes(action.label),
  );
  if (extra) {
    actions.unshift({
      label: extra,
      applicable: true,
      icon: <svg />,
      onSelect: () => Promise.resolve(),
    });
  }
  stubWidths(headerWidth, titleWidth);
  return render(
    <Tooltip.Provider>
      <div data-header>
        {titleFloor > 0 && (
          <span style={{ minWidth: `${titleFloor}px` }}>Pipe</span>
        )}
        {titleWidth > 0 && (
          <span data-title style={{ flexShrink: 0 }}>
            Pipe
          </span>
        )}
        <ActionsBar actions={actions} />
      </div>
    </Tooltip.Provider>,
  );
};

const button = (name: string) => screen.queryByRole("button", { name });

const moreActions = () => button("More actions");

const stubWidths = (headerWidth: number, titleWidth = 0) => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: function (this: HTMLElement) {
      return this.hasAttribute("data-header") ? headerWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: function (this: HTMLElement) {
      if (this.tagName === "BUTTON") return BUTTON_WIDTH;
      return this.hasAttribute("data-title") ? titleWidth : 0;
    },
  });
};

const sizeWatchers: (() => void)[] = [];

const layOut = () => act(() => sizeWatchers.forEach((watcher) => watcher()));

beforeEach(() => {
  sizeWatchers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        sizeWatchers.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 0,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 300,
  });
});
