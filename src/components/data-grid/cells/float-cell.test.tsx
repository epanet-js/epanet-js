import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { FloatCell, floatColumn } from "./float-cell";

const setupUser = () => userEvent.setup();

const defaultProps = {
  value: 1.5,
  rowIndex: 0,
  columnIndex: 0,
  isActive: false,
  isEditing: false,
  isSelected: false,
  readOnly: false,
  onChange: vi.fn(),
  stopEditing: vi.fn(),
  focus: false,
};

describe("FloatCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("display mode", () => {
    it("renders formatted number value", () => {
      render(<FloatCell {...defaultProps} value={1234.5} />);

      // Intl.NumberFormat formats with locale-specific separators
      expect(screen.getByText(/1.*234.*5/)).toBeInTheDocument();
    });

    it("renders empty string for null value", () => {
      const { container } = render(
        <FloatCell {...defaultProps} value={null} />,
      );

      const div = container.querySelector(".tabular-nums");
      expect(div?.textContent).toBe("");
    });

    it("renders empty string for undefined value", () => {
      const { container } = render(
        <FloatCell {...defaultProps} value={undefined as unknown as null} />,
      );

      const div = container.querySelector(".tabular-nums");
      expect(div?.textContent).toBe("");
    });
  });

  describe("edit mode", () => {
    it("renders input when isEditing and focus are true", () => {
      render(<FloatCell {...defaultProps} isEditing={true} focus={true} />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("does not render input when only isEditing is true", () => {
      render(<FloatCell {...defaultProps} isEditing={true} focus={false} />);

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("populates input with formatted value (not formatted)", () => {
      render(
        <FloatCell
          {...defaultProps}
          value={1234.5}
          isEditing={true}
          focus={true}
        />,
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("1,234.5");
    });

    it("populates input with empty string for null value", () => {
      render(
        <FloatCell
          {...defaultProps}
          value={null}
          isEditing={true}
          focus={true}
        />,
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("");
    });
  });

  describe("input handling", () => {
    it("accepts numeric input", async () => {
      const user = setupUser();

      render(
        <FloatCell {...defaultProps} value={0} isEditing={true} focus={true} />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "123.45");

      expect(input).toHaveValue("123.45");
    });

    it("normalizes comma to be kept (comma is allowed)", async () => {
      const user = setupUser();

      render(
        <FloatCell {...defaultProps} value={0} isEditing={true} focus={true} />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "123,45");

      // Comma is allowed in input (will be normalized on parse)
      expect(input).toHaveValue("123,45");
    });

    it("accepts negative numbers", async () => {
      const user = setupUser();

      render(
        <FloatCell {...defaultProps} value={0} isEditing={true} focus={true} />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "-42.5");

      expect(input).toHaveValue("-42.5");
    });

    it("filters out letters", async () => {
      const user = setupUser();

      render(
        <FloatCell {...defaultProps} value={0} isEditing={true} focus={true} />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "12abc34");

      expect(input).toHaveValue("1234");
    });
  });

  describe("value commit", () => {
    it("commits value on Enter", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const stopEditing = vi.fn();

      render(
        <FloatCell
          {...defaultProps}
          value={0}
          isEditing={true}
          focus={true}
          onChange={onChange}
          stopEditing={stopEditing}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "2.5");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith(2.5);
      expect(stopEditing).not.toHaveBeenCalled();
    });

    it("commits value on blur", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const stopEditing = vi.fn();

      render(
        <div>
          <FloatCell
            {...defaultProps}
            value={0}
            isEditing={true}
            focus={true}
            onChange={onChange}
            stopEditing={stopEditing}
          />
          <button>Other</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "3.14");
      await user.click(screen.getByRole("button", { name: "Other" }));

      expect(onChange).toHaveBeenCalledWith(3.14);
      expect(stopEditing).toHaveBeenCalled();
    });

    it("parses numbers with period as decimal separator", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <FloatCell
          {...defaultProps}
          value={0}
          isEditing={true}
          focus={true}
          onChange={onChange}
          stopEditing={vi.fn()}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "1.5");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith(1.5);
    });

    it("returns null for invalid input", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <FloatCell
          {...defaultProps}
          value={0}
          isEditing={true}
          focus={true}
          onChange={onChange}
          stopEditing={vi.fn()}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe("escape key", () => {
    it("stops editing without committing", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const stopEditing = vi.fn();

      render(
        <FloatCell
          {...defaultProps}
          value={5}
          isEditing={true}
          focus={true}
          onChange={onChange}
          stopEditing={stopEditing}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "999");
      await user.keyboard("{Escape}");

      expect(stopEditing).toHaveBeenCalled();
      // onChange should not be called with 999
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

describe("floatColumn", () => {
  describe("column definition", () => {
    it("creates column with correct properties", () => {
      const column = floatColumn("price", {
        header: "Price",
        size: 100,
        deleteValue: 0,
      });

      expect(column.accessorKey).toBe("price");
      expect(column.header).toBe("Price");
      expect(column.size).toBe(100);
      expect(column.deleteValue).toBe(0);
    });

    it("uses null as default deleteValue", () => {
      const column = floatColumn("value", { header: "Value" });

      expect(column.deleteValue).toBeNull();
    });
  });

  describe("copyValue", () => {
    it("converts number to string", () => {
      const column = floatColumn("value", { header: "Value" });

      expect(column.copyValue?.(123.45)).toBe("123.45");
    });

    it("returns empty string for null", () => {
      const column = floatColumn("value", { header: "Value" });

      expect(column.copyValue?.(null)).toBe("");
    });
  });

  describe("pasteValue", () => {
    it("parses valid number string", () => {
      const column = floatColumn("value", { header: "Value" });

      expect(column.pasteValue?.("123.45")).toBe(123.45);
    });

    it("parses numbers with thousands separator", () => {
      const column = floatColumn("value", { header: "Value" });

      // In English locale, comma is thousands separator
      expect(column.pasteValue?.("1,234.56")).toBe(1234.56);
    });

    it("returns null for invalid string", () => {
      const column = floatColumn("value", { header: "Value" });

      expect(column.pasteValue?.("abc")).toBeNull();
      expect(column.pasteValue?.("")).toBeNull();
    });

    it("parses negative numbers", () => {
      const column = floatColumn("value", { header: "Value" });

      expect(column.pasteValue?.("-42.5")).toBe(-42.5);
    });
  });
});
