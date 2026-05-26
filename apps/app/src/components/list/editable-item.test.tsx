import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableListItem } from "./editable-item";

const setupUser = () => userEvent.setup();
const getInput = () => screen.getByRole("textbox");

describe("EditableListItem", () => {
  const defaultProps = {
    item: { id: 1, label: "Item One" },
    isSelected: false,
    onSelect: vi.fn(),
    onLabelChange: vi.fn(() => false),
    onCancel: vi.fn(),
  };

  describe("default mode (no editing)", () => {
    it("renders the item as a button when editLabelMode is null", () => {
      render(
        <ul>
          <EditableListItem {...defaultProps} editLabelMode={null} />
        </ul>,
      );

      expect(
        screen.getByRole("button", { name: "Item One" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("inline editing", () => {
    it("shows input with item label instead of the button", () => {
      render(
        <ul>
          <EditableListItem {...defaultProps} editLabelMode="inline" />
        </ul>,
      );

      expect(getInput()).toHaveValue("Item One");
      expect(
        screen.queryByRole("button", { name: "Item One" }),
      ).not.toBeInTheDocument();
    });

    it("calls onLabelChange on Enter", async () => {
      const user = setupUser();
      const onLabelChange = vi.fn(() => false);

      render(
        <ul>
          <EditableListItem
            {...defaultProps}
            editLabelMode="inline"
            onLabelChange={onLabelChange}
          />
        </ul>,
      );

      await user.clear(getInput());
      await user.type(getInput(), "Renamed");
      await user.keyboard("{Enter}");

      expect(onLabelChange).toHaveBeenCalledWith("Renamed");
    });

    it("calls onCancel on Escape", async () => {
      const user = setupUser();
      const onCancel = vi.fn();

      render(
        <ul>
          <EditableListItem
            {...defaultProps}
            editLabelMode="inline"
            onCancel={onCancel}
          />
        </ul>,
      );

      await user.keyboard("{Escape}");

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("below editing", () => {
    it("renders both the item button and an input", () => {
      render(
        <ul>
          <EditableListItem {...defaultProps} editLabelMode="below" />
        </ul>,
      );

      expect(
        screen.getByRole("button", { name: "Item One" }),
      ).toBeInTheDocument();
      expect(getInput()).toBeInTheDocument();
      expect(getInput()).toHaveValue("Item One");
    });

    it("calls onLabelChange on Enter", async () => {
      const user = setupUser();
      const onLabelChange = vi.fn(() => false);

      render(
        <ul>
          <EditableListItem
            {...defaultProps}
            editLabelMode="below"
            onLabelChange={onLabelChange}
          />
        </ul>,
      );

      await user.clear(getInput());
      await user.type(getInput(), "Cloned");
      await user.keyboard("{Enter}");

      expect(onLabelChange).toHaveBeenCalledWith("Cloned");
    });

    it("calls onCancel on Escape", async () => {
      const user = setupUser();
      const onCancel = vi.fn();

      render(
        <ul>
          <EditableListItem
            {...defaultProps}
            editLabelMode="below"
            onCancel={onCancel}
          />
        </ul>,
      );

      await user.keyboard("{Escape}");

      expect(onCancel).toHaveBeenCalled();
    });

    it("keeps input when onLabelChange returns true (validation error)", async () => {
      const user = setupUser();
      const onLabelChange = vi.fn(() => true);

      render(
        <ul>
          <EditableListItem
            {...defaultProps}
            editLabelMode="below"
            onLabelChange={onLabelChange}
          />
        </ul>,
      );

      await user.clear(getInput());
      await user.type(getInput(), "DUPLICATE");
      await user.keyboard("{Enter}");

      expect(getInput()).toBeInTheDocument();
    });
  });
});
