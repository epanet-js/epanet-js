import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { TextCell, textColumn } from "./text-cell";

const setupUser = () => userEvent.setup();

const defaultProps = {
  value: "hello",
  rowIndex: 0,
  columnIndex: 0,
  isActive: false,
  editMode: false as const,
  readOnly: false,
  onChange: vi.fn(),
  stopEditing: vi.fn(),
  startEditing: vi.fn(),
};

describe("TextCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("display mode", () => {
    it("renders string value", () => {
      render(<TextCell {...defaultProps} value="pipe-1" />);

      expect(screen.getByDisplayValue("pipe-1")).toBeInTheDocument();
    });

    it("renders empty string for null value", () => {
      render(<TextCell {...defaultProps} value={null} />);

      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  describe("edit mode", () => {
    it("renders input when editMode is set", () => {
      render(<TextCell {...defaultProps} editMode="full" />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("populates input with current value", () => {
      render(<TextCell {...defaultProps} value="pipe-1" editMode="full" />);

      expect(screen.getByRole("textbox")).toHaveValue("pipe-1");
    });

    it("populates input with empty string for null value", () => {
      render(<TextCell {...defaultProps} value={null} editMode="full" />);

      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  describe("input handling", () => {
    it("accepts text input", async () => {
      const user = setupUser();

      render(<TextCell {...defaultProps} value={null} editMode="full" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "node-42");

      expect(input).toHaveValue("node-42");
    });

    it("allows clearing the field", async () => {
      const user = setupUser();

      render(<TextCell {...defaultProps} value="pipe-1" editMode="full" />);

      const input = screen.getByRole("textbox");
      await user.clear(input);

      expect(input).toHaveValue("");
    });
  });

  describe("value commit", () => {
    it("commits value on Enter", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <TextCell
          {...defaultProps}
          value={null}
          editMode="full"
          onChange={onChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "node-1");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith("node-1");
    });

    it("commits null when field is cleared and Enter is pressed", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <TextCell
          {...defaultProps}
          value="pipe-1"
          editMode="full"
          onChange={onChange}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("commits value on blur", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <div>
          <TextCell
            {...defaultProps}
            value={null}
            editMode="full"
            onChange={onChange}
          />
          <button>Other</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "node-2");
      await user.click(screen.getByRole("button", { name: "Other" }));

      expect(onChange).toHaveBeenCalledWith("node-2");
    });
  });

  describe("escape key", () => {
    it("stops editing without committing", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const stopEditing = vi.fn();

      render(
        <TextCell
          {...defaultProps}
          value="original"
          editMode="full"
          onChange={onChange}
          stopEditing={stopEditing}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "changed");
      await user.keyboard("{Escape}");

      expect(stopEditing).toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("validate prop", () => {
    const noSpaces = (v: string) => !v.includes(" ");

    describe("commit behavior (synchronous)", () => {
      it("does not commit invalid value on Enter", async () => {
        const user = setupUser();
        const onChange = vi.fn();

        render(
          <TextCell
            {...defaultProps}
            value={null}
            editMode="full"
            onChange={onChange}
            validate={noSpaces}
          />,
        );

        await user.type(screen.getByRole("textbox"), "bad value");
        await user.keyboard("{Enter}");

        expect(onChange).not.toHaveBeenCalled();
      });

      it("does not commit invalid value on blur", async () => {
        const user = setupUser();
        const onChange = vi.fn();

        render(
          <div>
            <TextCell
              {...defaultProps}
              value={null}
              editMode="full"
              onChange={onChange}
              validate={noSpaces}
            />
            <button>Other</button>
          </div>,
        );

        await user.type(screen.getByRole("textbox"), "bad value");
        await user.click(screen.getByRole("button", { name: "Other" }));

        expect(onChange).not.toHaveBeenCalled();
      });

      it("commits valid value normally when validate is provided", async () => {
        const user = setupUser();
        const onChange = vi.fn();

        render(
          <TextCell
            {...defaultProps}
            value={null}
            editMode="full"
            onChange={onChange}
            validate={noSpaces}
          />,
        );

        await user.type(screen.getByRole("textbox"), "goodvalue");
        await user.keyboard("{Enter}");

        expect(onChange).toHaveBeenCalledWith("goodvalue");
      });
    });

    describe("error display (debounced)", () => {
      it("shows error style after debounce when input is invalid", async () => {
        const user = setupUser();

        const { container } = render(
          <TextCell
            {...defaultProps}
            value={null}
            editMode="full"
            validate={noSpaces}
          />,
        );

        await user.type(screen.getByRole("textbox"), "bad value");
        expect(container.firstChild).not.toHaveClass("ring-1");

        await waitFor(() => expect(container.firstChild).toHaveClass("ring-1"));
      });

      it("does not show error style for empty input", async () => {
        const user = setupUser();

        const { container } = render(
          <TextCell
            {...defaultProps}
            value="pipe 1"
            editMode="full"
            validate={noSpaces}
          />,
        );

        await user.clear(screen.getByRole("textbox"));

        // Give debounce time to fire, then assert no error
        await waitFor(() =>
          expect(container.firstChild).not.toHaveClass("ring-1"),
        );
      });

      it("clears error when input becomes valid", async () => {
        const user = setupUser();

        const { container } = render(
          <TextCell
            {...defaultProps}
            value={null}
            editMode="full"
            validate={noSpaces}
          />,
        );

        const input = screen.getByRole("textbox");
        await user.type(input, "bad value");
        await waitFor(() => expect(container.firstChild).toHaveClass("ring-1"));

        await user.clear(input);
        await user.type(input, "goodvalue");
        await waitFor(() =>
          expect(container.firstChild).not.toHaveClass("ring-1"),
        );
      });

      it("resets error when edit mode ends", async () => {
        const user = setupUser();

        const { container, rerender } = render(
          <TextCell
            {...defaultProps}
            value={null}
            editMode="full"
            validate={noSpaces}
          />,
        );

        await user.type(screen.getByRole("textbox"), "bad value");
        await waitFor(() => expect(container.firstChild).toHaveClass("ring-1"));

        rerender(
          <TextCell
            {...defaultProps}
            value={null}
            editMode={false}
            validate={noSpaces}
          />,
        );

        expect(container.firstChild).not.toHaveClass("ring-1");
      });
    });
  });

  describe("allowedChars prop", () => {
    it("filters out characters not matching the pattern as they are typed", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <TextCell
          {...defaultProps}
          value={null}
          editMode="full"
          onChange={onChange}
          allowedChars={/[a-zA-Z0-9]/}
        />,
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "ab 1;2!c");
      expect(input).toHaveValue("ab12c");

      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("ab12c");
    });
  });

  describe("maxByteLength prop", () => {
    it("truncates by UTF-8 byte length", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <TextCell
          {...defaultProps}
          value={null}
          editMode="full"
          onChange={onChange}
          maxByteLength={4}
        />,
      );

      const input = screen.getByRole("textbox");
      // 'é' = 2 bytes; 4 bytes max keeps only 2 of them
      await user.type(input, "éééé");
      expect(input).toHaveValue("éé");

      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("éé");
    });
  });

  describe("maxLength prop", () => {
    it("truncates by character count, not bytes", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <TextCell
          {...defaultProps}
          value={null}
          editMode="full"
          onChange={onChange}
          maxLength={4}
        />,
      );

      const input = screen.getByRole("textbox");
      // 4 multi-byte chars (8 bytes) — should all fit under maxLength=4
      await user.type(input, "éééééé");
      expect(input).toHaveValue("éééé");

      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("éééé");
    });
  });

  describe("readonly prop", () => {
    it("renders text div instead of an input", () => {
      render(<TextCell {...defaultProps} value="pipe-1" readonly />);

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.getByText("pipe-1")).toBeInTheDocument();
    });

    it("renders empty for null value", () => {
      const { container } = render(
        <TextCell {...defaultProps} value={null} readonly />,
      );

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(container.firstChild).toHaveTextContent("");
    });
  });
});

describe("textColumn", () => {
  describe("column definition", () => {
    it("creates column with correct properties", () => {
      const column = textColumn("name", { header: "Name", size: 120 });

      expect(column).toMatchObject({
        accessorKey: "name",
        header: "Name",
        size: 120,
      });
    });

    it("uses null as default deleteValue", () => {
      const column = textColumn("name", { header: "Name" });

      expect(column.meta?.deleteValue).toBeNull();
    });
  });

  describe("copyValue", () => {
    it("returns the string value", () => {
      const column = textColumn("name", { header: "Name" });

      expect(column.meta?.copyValue?.("pipe-1")).toBe("pipe-1");
    });

    it("returns empty string for null", () => {
      const column = textColumn("name", { header: "Name" });

      expect(column.meta?.copyValue?.(null)).toBe("");
    });
  });

  describe("pasteValue", () => {
    it("returns the pasted string", () => {
      const column = textColumn("name", { header: "Name" });

      expect(column.meta?.pasteValue?.("pipe-1")).toBe("pipe-1");
    });

    it("returns null for empty string", () => {
      const column = textColumn("name", { header: "Name" });

      expect(column.meta?.pasteValue?.("")).toBeNull();
    });

    it("strips characters not matching allowedChars", () => {
      const column = textColumn("name", {
        header: "Name",
        allowedChars: /[a-zA-Z0-9]/,
      });

      expect(column.meta?.pasteValue?.("pipe 1;2!")).toBe("pipe12");
    });

    it("truncates by maxByteLength", () => {
      const column = textColumn("name", {
        header: "Name",
        maxByteLength: 4,
      });

      // 'é' = 2 bytes
      expect(column.meta?.pasteValue?.("éééé")).toBe("éé");
    });

    it("truncates by maxLength using character count", () => {
      const column = textColumn("name", {
        header: "Name",
        maxLength: 3,
      });

      expect(column.meta?.pasteValue?.("éééééé")).toBe("ééé");
    });

    it("returns null when filtering leaves an empty string", () => {
      const column = textColumn("name", {
        header: "Name",
        allowedChars: /[a-zA-Z0-9]/,
      });

      expect(column.meta?.pasteValue?.(" ;!")).toBeNull();
    });
  });

  describe("isReadOnly option", () => {
    it("sets meta.isReadOnly on the column", () => {
      const column = textColumn("name", { header: "Name", isReadOnly: true });

      expect(column.meta?.isReadOnly).toBe(true);
    });

    it("does not set meta.isReadOnly when not readonly", () => {
      const column = textColumn("name", { header: "Name" });

      expect(column.meta?.isReadOnly).toBeFalsy();
    });
  });
});
