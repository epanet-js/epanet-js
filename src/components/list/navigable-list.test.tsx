import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavigableList, type NavItem } from "./navigable-list";

const setupUser = () => userEvent.setup();

describe("NavigableList", () => {
  const onSelectItem = vi.fn();
  const onToggleSection = vi.fn();

  beforeEach(() => {
    onSelectItem.mockClear();
    onToggleSection.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  const navItems: NavItem[] = [
    { id: 1, section: "alpha" },
    { id: 2, section: "alpha" },
    { id: 3, section: "beta" },
  ];

  const defaultChildren = (
    <>
      <div data-section-type="alpha" />
      <div data-item-id="1" />
      <div data-item-id="2" />
      <div data-section-type="beta" />
      <div data-item-id="3" />
    </>
  );

  const renderList = ({
    items = navItems,
    focusedItem,
    sectionStatus = { alpha: true, beta: true },
    isNavBlocked,
    children = defaultChildren,
  }: {
    items?: NavItem[];
    focusedItem?: NavItem;
    sectionStatus?: Record<string, boolean>;
    isNavBlocked?: boolean;
    children?: React.ReactNode;
  } = {}) =>
    render(
      <NavigableList
        navItems={items}
        focusedItem={focusedItem}
        onSelectItem={onSelectItem}
        sectionStatus={sectionStatus}
        onToggleSection={onToggleSection}
        isNavBlocked={isNavBlocked}
      >
        {children}
      </NavigableList>,
    );

  const getList = (container: HTMLElement) =>
    container.firstElementChild as HTMLElement;

  describe("section status", () => {
    it("includes items from expanded sections in navigation", async () => {
      const user = setupUser();
      renderList({ focusedItem: { section: "alpha" } });
      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(onSelectItem).toHaveBeenCalledWith({ id: 1, section: "alpha" });
    });

    it("skips items from collapsed sections in navigation", async () => {
      const user = setupUser();
      renderList({
        focusedItem: { section: "alpha" },
        sectionStatus: { alpha: false, beta: true },
      });
      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(onSelectItem).toHaveBeenCalledWith({ section: "beta" });
    });

    it("navigates to empty section header", async () => {
      const user = setupUser();
      renderList({
        items: [],
        sectionStatus: { alpha: true, beta: true },
      });
      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(onSelectItem).toHaveBeenCalledWith({ section: "alpha" });
    });
  });

  describe("ArrowDown", () => {
    it("selects first item when nothing is focused", async () => {
      const user = setupUser();
      renderList();
      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(onSelectItem).toHaveBeenCalledWith({ section: "alpha" });
    });

    it("advances to the next item", async () => {
      const user = setupUser();
      renderList({ focusedItem: { id: 1, section: "alpha" } });
      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(onSelectItem).toHaveBeenCalledWith({ id: 2, section: "alpha" });
    });

    it("wraps to the start", async () => {
      const user = setupUser();
      renderList({ focusedItem: { id: 3, section: "beta" } });
      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(onSelectItem).toHaveBeenCalledWith({ section: "alpha" });
    });
  });

  describe("ArrowUp", () => {
    it("wraps to the end when at the start", async () => {
      const user = setupUser();
      renderList({ focusedItem: { section: "alpha" } });
      await user.tab();
      await user.keyboard("{ArrowUp}");
      expect(onSelectItem).toHaveBeenCalledWith({ id: 3, section: "beta" });
    });

    it("moves to the previous item", async () => {
      const user = setupUser();
      renderList({ focusedItem: { id: 2, section: "alpha" } });
      await user.tab();
      await user.keyboard("{ArrowUp}");
      expect(onSelectItem).toHaveBeenCalledWith({ id: 1, section: "alpha" });
    });
  });

  describe("Home and End", () => {
    it("Home navigates to the first item", async () => {
      const user = setupUser();
      renderList({ focusedItem: { id: 3, section: "beta" } });
      await user.tab();
      await user.keyboard("{Home}");
      expect(onSelectItem).toHaveBeenCalledWith({ section: "alpha" });
    });

    it("End navigates to the last item", async () => {
      const user = setupUser();
      renderList({ focusedItem: { section: "alpha" } });
      await user.tab();
      await user.keyboard("{End}");
      expect(onSelectItem).toHaveBeenCalledWith({ id: 3, section: "beta" });
    });
  });

  describe("Enter", () => {
    it("toggles the focused section", async () => {
      const user = setupUser();
      renderList({ focusedItem: { section: "alpha" } });
      await user.tab();
      await user.keyboard("{Enter}");
      expect(onToggleSection).toHaveBeenCalledWith("alpha");
    });

    it("does not toggle when focused on an item", async () => {
      const user = setupUser();
      renderList({ focusedItem: { id: 1, section: "alpha" } });
      await user.tab();
      await user.keyboard("{Enter}");
      expect(onToggleSection).not.toHaveBeenCalled();
    });

    it("does nothing when nothing is focused", async () => {
      const user = setupUser();
      renderList();
      await user.tab();
      await user.keyboard("{Enter}");
      expect(onToggleSection).not.toHaveBeenCalled();
    });
  });

  describe("Escape", () => {
    it("navigates to parent section when focused on an item", async () => {
      const user = setupUser();
      renderList({ focusedItem: { id: 2, section: "alpha" } });
      await user.tab();
      await user.keyboard("{Escape}");
      expect(onSelectItem).toHaveBeenCalledWith({ section: "alpha" });
    });

    it("does nothing when focused on a section header", async () => {
      const user = setupUser();
      renderList({ focusedItem: { section: "beta" } });
      await user.tab();
      await user.keyboard("{Escape}");
      expect(onSelectItem).not.toHaveBeenCalled();
    });
  });

  describe("isNavBlocked", () => {
    it("ignores all keyboard navigation when blocked", async () => {
      const user = setupUser();
      renderList({
        focusedItem: { section: "alpha" },
        isNavBlocked: true,
      });
      await user.tab();
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");
      await user.keyboard("{Home}");
      expect(onSelectItem).not.toHaveBeenCalled();
      expect(onToggleSection).not.toHaveBeenCalled();
    });
  });

  describe("data-capture-escape-key", () => {
    it("is set when focusedItem has an id", () => {
      const { container } = renderList({
        focusedItem: { id: 1, section: "alpha" },
      });
      expect(getList(container)).toHaveAttribute("data-capture-escape-key");
    });

    it("is not set when focusedItem is a section", () => {
      const { container } = renderList({
        focusedItem: { section: "alpha" },
      });
      expect(getList(container)).not.toHaveAttribute("data-capture-escape-key");
    });

    it("is not set when nothing is focused", () => {
      const { container } = renderList();
      expect(getList(container)).not.toHaveAttribute("data-capture-escape-key");
    });
  });
});
