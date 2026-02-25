import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import {
  PatternSidebarItem,
  ActionState,
  TypedPattern,
} from "./pattern-sidebar-shared";

const setupUser = () => userEvent.setup();

const createPattern = (
  overrides: Partial<TypedPattern> = {},
): TypedPattern => ({
  id: 1,
  label: "PATTERN1",
  multipliers: [1.0, 0.8],
  type: "demand",
  ...overrides,
});

const getInput = () => screen.getByRole("textbox");

describe("PatternSidebarItem", () => {
  const defaultProps = {
    pattern: createPattern(),
    isSelected: false,
    onSelect: vi.fn(),
    actionState: undefined as ActionState | undefined,
    onCancel: vi.fn(),
    onStartRename: vi.fn(),
    onStartClone: vi.fn(),
    onDelete: vi.fn(),
    onPatternLabelChange: vi.fn(() => false),
    readOnly: false,
  };

  const renderItem = (overrides: Partial<typeof defaultProps> = {}) =>
    render(
      <ul>
        <PatternSidebarItem {...defaultProps} {...overrides} />
      </ul>,
    );

  describe("rendering", () => {
    it("renders pattern label as a button", () => {
      renderItem();

      expect(
        screen.getByRole("button", { name: "PATTERN1" }),
      ).toBeInTheDocument();
    });

    it("shows actions menu button", () => {
      renderItem();

      expect(
        screen.getByRole("button", { name: /actions/i }),
      ).toBeInTheDocument();
    });

    it("hides actions menu in readOnly mode", () => {
      renderItem({ readOnly: true });

      expect(
        screen.queryByRole("button", { name: /actions/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("selecting", () => {
    it("calls onSelect when clicking the pattern button", async () => {
      const user = setupUser();
      const onSelect = vi.fn();
      renderItem({ onSelect });

      await user.click(screen.getByRole("button", { name: "PATTERN1" }));

      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe("actions menu", () => {
    it("calls onStartRename from menu", async () => {
      const user = setupUser();
      const pattern = createPattern({ id: 5 });
      const onStartRename = vi.fn();
      renderItem({ pattern, onStartRename });

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /rename/i }));

      expect(onStartRename).toHaveBeenCalledWith(5);
    });

    it("calls onStartClone from menu", async () => {
      const user = setupUser();
      const pattern = createPattern({ id: 5, label: "MY_PATTERN" });
      const onStartClone = vi.fn();
      renderItem({ pattern, onStartClone });

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      expect(onStartClone).toHaveBeenCalledWith(pattern);
    });

    it("calls onDelete from menu", async () => {
      const user = setupUser();
      const onDelete = vi.fn();
      renderItem({ onDelete });

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe("renaming", () => {
    it("shows input with current label when actionState is renaming", () => {
      const pattern = createPattern({ id: 1, label: "PATTERN1" });
      renderItem({
        pattern,
        actionState: { action: "renaming", patternId: 1 },
      });

      const input = getInput();
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("PATTERN1");
    });

    it("does not show rename input when actionState targets a different pattern", () => {
      const pattern = createPattern({ id: 1 });
      renderItem({
        pattern,
        actionState: { action: "renaming", patternId: 999 },
      });

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "PATTERN1" }),
      ).toBeInTheDocument();
    });

    it("calls onPatternLabelChange on Enter", async () => {
      const user = setupUser();
      const onPatternLabelChange = vi.fn(() => false);
      const pattern = createPattern({ id: 1, label: "PATTERN1" });
      renderItem({
        pattern,
        actionState: { action: "renaming", patternId: 1 },
        onPatternLabelChange,
      });

      const input = getInput();
      await user.clear(input);
      await user.type(input, "NEWNAME");
      await user.keyboard("{Enter}");

      expect(onPatternLabelChange).toHaveBeenCalledWith("NEWNAME");
    });

    it("calls onCancel on Escape", async () => {
      const user = setupUser();
      const onCancel = vi.fn();
      const pattern = createPattern({ id: 1 });
      renderItem({
        pattern,
        actionState: { action: "renaming", patternId: 1 },
        onCancel,
      });

      await user.keyboard("{Escape}");

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("cloning", () => {
    const sourcePattern = createPattern({
      id: 1,
      label: "PATTERN1",
      multipliers: [1.0, 0.8, 1.2],
    });

    it("shows input pre-filled with source label", () => {
      renderItem({
        pattern: sourcePattern,
        actionState: { action: "cloning", sourcePattern },
      });

      const input = getInput();
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("PATTERN1");
    });

    it("still renders the source pattern button alongside the clone input", () => {
      renderItem({
        pattern: sourcePattern,
        actionState: { action: "cloning", sourcePattern },
      });

      expect(
        screen.getByRole("button", { name: "PATTERN1" }),
      ).toBeInTheDocument();
      expect(getInput()).toBeInTheDocument();
    });

    it("does not show clone input when actionState targets a different pattern", () => {
      const otherPattern = createPattern({ id: 999, label: "OTHER" });
      renderItem({
        pattern: sourcePattern,
        actionState: { action: "cloning", sourcePattern: otherPattern },
      });

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("calls onPatternLabelChange on Enter", async () => {
      const user = setupUser();
      const onPatternLabelChange = vi.fn(() => false);
      renderItem({
        pattern: sourcePattern,
        actionState: { action: "cloning", sourcePattern },
        onPatternLabelChange,
      });

      const input = getInput();
      await user.clear(input);
      await user.type(input, "CLONED");
      await user.keyboard("{Enter}");

      expect(onPatternLabelChange).toHaveBeenCalledWith("CLONED");
    });

    it("calls onCancel on Escape", async () => {
      const user = setupUser();
      const onCancel = vi.fn();
      renderItem({
        pattern: sourcePattern,
        actionState: { action: "cloning", sourcePattern },
        onCancel,
      });

      await user.keyboard("{Escape}");

      expect(onCancel).toHaveBeenCalled();
    });

    it("keeps input when onPatternLabelChange returns true (validation error)", async () => {
      const user = setupUser();
      const onPatternLabelChange = vi.fn(() => true);
      renderItem({
        pattern: sourcePattern,
        actionState: { action: "cloning", sourcePattern },
        onPatternLabelChange,
      });

      const input = getInput();
      await user.clear(input);
      await user.type(input, "DUPLICATE_NAME");
      await user.keyboard("{Enter}");

      expect(input).toBeInTheDocument();
    });
  });
});
