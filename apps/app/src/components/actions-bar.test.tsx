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

  it("moves the actions that do not fit into the more actions menu", async () => {
    const user = userEvent.setup();
    renderHeader(100);

    expect(button("Zoom to")).toBeInTheDocument();
    expect(button("Reverse")).toBeInTheDocument();
    expect(button("Redraw")).not.toBeInTheDocument();
    expect(button("Delete")).not.toBeInTheDocument();

    await user.click(moreActions() as HTMLElement);

    expect(screen.getByRole("menuitem", { name: "Redraw" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  });

  it("runs an action selected from the more actions menu", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    renderHeader(100, { onDelete: onSelect });

    await user.click(moreActions() as HTMLElement);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onSelect).toHaveBeenCalled();
  });

  it("leaves the title the floor it declares", () => {
    renderHeader(200, { titleFloor: 100 });

    expect(button("Reverse")).toBeInTheDocument();
    expect(button("Redraw")).not.toBeInTheDocument();
    expect(moreActions()).toBeInTheDocument();
  });

  it("leaves a title that cannot shrink the width it takes", () => {
    renderHeader(200, { titleWidth: 100 });

    expect(button("Reverse")).toBeInTheDocument();
    expect(button("Redraw")).not.toBeInTheDocument();
    expect(moreActions()).toBeInTheDocument();
  });

  it("takes the whole header when the title reserves nothing", () => {
    renderHeader(200);

    expect(button("Delete")).toBeInTheDocument();
    expect(moreActions()).not.toBeInTheDocument();
  });

  it("gives the actions back when the header grows", () => {
    renderHeader(100);

    expect(button("Delete")).not.toBeInTheDocument();

    stubWidths(500);
    layOut();

    expect(button("Delete")).toBeInTheDocument();
    expect(moreActions()).not.toBeInTheDocument();
  });
});

const BUTTON_WIDTH = 32;

const buildActions = (onDelete: () => Promise<void>): Action[] =>
  ["Zoom to", "Reverse", "Redraw", "Delete"].map((label) => ({
    label,
    applicable: true,
    icon: <svg />,
    onSelect: label === "Delete" ? onDelete : () => Promise.resolve(),
  }));

const renderHeader = (
  headerWidth: number,
  {
    titleFloor = 0,
    titleWidth = 0,
    onDelete = () => Promise.resolve(),
  }: {
    titleFloor?: number;
    titleWidth?: number;
    onDelete?: () => Promise<void>;
  } = {},
) => {
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
        <ActionsBar actions={buildActions(onDelete)} />
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
