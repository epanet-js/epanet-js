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

  describe("actionState targeting", () => {
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

    it("does not show clone input when actionState targets a different pattern", () => {
      const sourcePattern = createPattern({ id: 1 });
      const otherPattern = createPattern({ id: 999, label: "OTHER" });
      renderItem({
        pattern: sourcePattern,
        actionState: { action: "cloning", sourcePattern: otherPattern },
      });

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });
});
