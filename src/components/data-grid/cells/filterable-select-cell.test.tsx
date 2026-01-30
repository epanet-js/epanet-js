/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FilterableSelectCell,
  filterableSelectColumn,
} from "./filterable-select-cell";

const setupUser = () => userEvent.setup();

describe("filterableSelectColumn", () => {
  const options = [
    { value: 0, label: "CONSTANT" },
    { value: 1, label: "Pattern A" },
    { value: 2, label: "Pattern B" },
  ];

  const column = filterableSelectColumn("category", {
    header: "Category",
    options,
  });

  describe("copyValue", () => {
    it("returns the label for a matching value", () => {
      expect(column.copyValue!(1)).toBe("Pattern A");
      expect(column.copyValue!(2)).toBe("Pattern B");
      expect(column.copyValue!(0)).toBe("CONSTANT");
    });

    it("returns empty string for non-matching value", () => {
      expect(column.copyValue!(999)).toBe("");
    });

    it("returns empty string for null/undefined", () => {
      expect(column.copyValue!(null)).toBe("");
      expect(column.copyValue!(undefined)).toBe("");
    });
  });

  describe("pasteValue", () => {
    it("matches by label (case-insensitive)", () => {
      expect(column.pasteValue!("Pattern A")).toBe(1);
      expect(column.pasteValue!("pattern a")).toBe(1);
      expect(column.pasteValue!("PATTERN A")).toBe(1);
      expect(column.pasteValue!("constant")).toBe(0);
    });

    it("matches by value string", () => {
      expect(column.pasteValue!("0")).toBe(0);
      expect(column.pasteValue!("1")).toBe(1);
      expect(column.pasteValue!("2")).toBe(2);
    });

    it("returns null for non-matching value", () => {
      expect(column.pasteValue!("nonexistent")).toBe(null);
      expect(column.pasteValue!("999")).toBe(null);
    });
  });

  describe("copy/paste round-trip", () => {
    it("preserves value through copy then paste", () => {
      const originalValue = 1;
      const copied = column.copyValue!(originalValue);
      const pasted = column.pasteValue!(copied);
      expect(pasted).toBe(originalValue);
    });

    it("preserves all option values through round-trip", () => {
      for (const option of options) {
        const copied = column.copyValue!(option.value);
        const pasted = column.pasteValue!(copied);
        expect(pasted).toBe(option.value);
      }
    });
  });
});

describe("FilterableSelectCell", () => {
  const options = [
    { value: 0, label: "CONSTANT" },
    { value: 1, label: "Pattern A" },
    { value: 2, label: "Pattern B" },
    { value: 3, label: "Pattern C" },
    { value: 4, label: "Pattern D" },
  ];

  const defaultProps = {
    value: 1,
    isEditing: false,
    onChange: vi.fn(),
    stopEditing: vi.fn(),
    focus: true,
    rowIndex: 0,
    columnIndex: 0,
    isActive: true,
    isSelected: true,
    options,
    placeholder: "Select...",
    minOptionsForSearch: 8, // Disable search by default for simpler tests
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("displays the selected option label", () => {
      render(<FilterableSelectCell {...defaultProps} value={1} />);
      expect(screen.getByText("Pattern A")).toBeInTheDocument();
    });

    it("displays placeholder when no value is selected", () => {
      render(<FilterableSelectCell {...defaultProps} value={null} />);
      expect(screen.getByText("Select...")).toBeInTheDocument();
    });

    it("displays placeholder for non-matching value", () => {
      render(<FilterableSelectCell {...defaultProps} value={999} />);
      expect(screen.getByText("Select...")).toBeInTheDocument();
    });
  });

  describe("opening popover", () => {
    it("opens on Enter key", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });

    it("opens on Space key", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });

    it("opens on ArrowDown key", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{ArrowDown}");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });

    it("opens on click", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });
  });

  describe("keyboard navigation", () => {
    it("navigates down with ArrowDown", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{ArrowDown}");

      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveClass("bg-purple-300/40");
    });

    it("navigates up with ArrowUp", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // ArrowUp from start goes to last item
      await user.keyboard("{ArrowUp}");

      const optionElements = screen.getAllByRole("option");
      expect(optionElements[optionElements.length - 1]).toHaveClass(
        "bg-purple-300/40",
      );
    });

    it("navigates to first item with Home", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Navigate down first, then Home
      await user.keyboard("{ArrowDown}{ArrowDown}{Home}");

      const optionElements = screen.getAllByRole("option");
      expect(optionElements[0]).toHaveClass("bg-purple-300/40");
    });

    it("navigates to last item with End", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{End}");

      const optionElements = screen.getAllByRole("option");
      expect(optionElements[optionElements.length - 1]).toHaveClass(
        "bg-purple-300/40",
      );
    });
  });

  describe("selection", () => {
    it("selects option on Enter when navigating", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      render(<FilterableSelectCell {...defaultProps} onChange={onChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Navigate to third option (Pattern B) and select
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it("selects option on click", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      render(<FilterableSelectCell {...defaultProps} onChange={onChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Pattern C"));

      expect(onChange).toHaveBeenCalledWith(3);
    });

    it("calls stopEditing after selection", async () => {
      const user = setupUser();
      const stopEditing = vi.fn();
      render(
        <FilterableSelectCell {...defaultProps} stopEditing={stopEditing} />,
      );

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Pattern C"));

      expect(stopEditing).toHaveBeenCalled();
    });
  });

  describe("closing popover", () => {
    it("closes on Escape", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("closes on Tab", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{Tab}");

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("calls stopEditing on close", async () => {
      const user = setupUser();
      const stopEditing = vi.fn();
      render(
        <FilterableSelectCell {...defaultProps} stopEditing={stopEditing} />,
      );

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(stopEditing).toHaveBeenCalled();
      });
    });
  });

  describe("with search enabled", () => {
    const manyOptions = [
      { value: 0, label: "CONSTANT" },
      { value: 1, label: "Pattern A" },
      { value: 2, label: "Pattern B" },
      { value: 3, label: "Pattern C" },
      { value: 4, label: "Pattern D" },
      { value: 5, label: "Pattern E" },
      { value: 6, label: "Pattern F" },
      { value: 7, label: "Pattern G" },
      { value: 8, label: "Another One" },
    ];

    const searchProps = {
      ...defaultProps,
      options: manyOptions,
      minOptionsForSearch: 8, // Enable search (9 options >= 8)
    };

    it("shows search input when options >= minOptionsForSearch", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });

    it("filters options based on search query", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "Another");

      await waitFor(() => {
        const optionElements = screen.getAllByRole("option");
        expect(optionElements).toHaveLength(1);
        expect(optionElements[0]).toHaveTextContent("Another One");
      });
    });

    it("shows all options when search is cleared", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "Another");

      await waitFor(() => {
        expect(screen.getAllByRole("option")).toHaveLength(1);
      });

      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getAllByRole("option")).toHaveLength(manyOptions.length);
      });
    });

    it("Escape returns to search mode when navigating", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Start navigating
      await user.keyboard("{ArrowDown}");

      // First option should be highlighted
      const optionElements = screen.getAllByRole("option");
      expect(optionElements[0]).toHaveClass("bg-purple-300/40");

      // Escape should return to search mode (not close)
      await user.keyboard("{Escape}");

      // Popover should still be open
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // No option should be highlighted
      const optionsAfterEscape = screen.getAllByRole("option");
      expect(optionsAfterEscape[0]).not.toHaveClass("bg-purple-300/40");
    });

    it("typing while navigating returns to search mode", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Start navigating
      await user.keyboard("{ArrowDown}");

      // Type a character - should switch to search mode
      await user.keyboard("A");

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText("Search...");
        expect(searchInput).toHaveValue("A");
      });
    });
  });

  describe("focus behavior", () => {
    it("focuses button when focus prop is true", () => {
      render(<FilterableSelectCell {...defaultProps} focus={true} />);

      const button = screen.getByRole("button");
      expect(document.activeElement).toBe(button);
    });

    it("closes popover when focus becomes false", async () => {
      const user = setupUser();
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} focus={true} />,
      );

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      rerender(<FilterableSelectCell {...defaultProps} focus={false} />);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("disables pointer events when focus is false", () => {
      const { container } = render(
        <FilterableSelectCell {...defaultProps} focus={false} />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ pointerEvents: "none" });
    });
  });

  describe("selected option indicator", () => {
    it("shows checkmark on currently selected option", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...defaultProps} value={2} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // The selected option (Pattern B) should have aria-selected="true"
      const optionElements = screen.getAllByRole("option");
      const selectedOption = optionElements.find(
        (el) => el.getAttribute("aria-selected") === "true",
      );
      expect(selectedOption).toHaveTextContent("Pattern B");
    });
  });
});
