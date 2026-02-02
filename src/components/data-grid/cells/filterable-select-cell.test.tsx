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
    editMode: false as const,
    onChange: vi.fn(),
    stopEditing: vi.fn(),
    startEditing: vi.fn(),
    rowIndex: 0,
    columnIndex: 0,
    isActive: true,
    readOnly: false,
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
    it("calls startEditing on Enter key", async () => {
      const user = setupUser();
      const startEditing = vi.fn();
      render(
        <FilterableSelectCell {...defaultProps} startEditing={startEditing} />,
      );

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(startEditing).toHaveBeenCalled();
    });

    it("calls startEditing on Space key", async () => {
      const user = setupUser();
      const startEditing = vi.fn();
      render(
        <FilterableSelectCell {...defaultProps} startEditing={startEditing} />,
      );

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");

      expect(startEditing).toHaveBeenCalled();
    });

    it("opens when editMode becomes truthy", async () => {
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} editMode={false} />,
      );

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

      rerender(<FilterableSelectCell {...defaultProps} editMode="full" />);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });

    it("calls startEditing on click", async () => {
      const user = setupUser();
      const startEditing = vi.fn();
      render(
        <FilterableSelectCell {...defaultProps} startEditing={startEditing} />,
      );

      await user.click(screen.getByRole("button"));

      expect(startEditing).toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("navigates down with ArrowDown", async () => {
      const user = setupUser();
      // Render closed first to initialize activeIndex based on value
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} editMode={false} />,
      );
      rerender(<FilterableSelectCell {...defaultProps} editMode="full" />);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Current value is 1 (Pattern A, index 1), ArrowDown goes to index 2 (Pattern B)
      await user.keyboard("{ArrowDown}");

      const optionElements = screen.getAllByRole("option");
      expect(optionElements[2]).toHaveClass("bg-purple-300/40"); // Pattern B
    });

    it("navigates up with ArrowUp", async () => {
      const user = setupUser();
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} editMode={false} />,
      );
      rerender(<FilterableSelectCell {...defaultProps} editMode="full" />);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Current value is 1 (Pattern A, index 1), ArrowUp goes to index 0 (CONSTANT)
      await user.keyboard("{ArrowUp}");

      const optionElements = screen.getAllByRole("option");
      expect(optionElements[0]).toHaveClass("bg-purple-300/40"); // CONSTANT
    });

    it("ArrowUp from first item wraps to last item", async () => {
      const user = setupUser();
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} value={0} editMode={false} />,
      );
      rerender(
        <FilterableSelectCell {...defaultProps} value={0} editMode="full" />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Current value is 0 (CONSTANT, index 0), ArrowUp wraps to last item
      await user.keyboard("{ArrowUp}");

      const optionElements = screen.getAllByRole("option");
      expect(optionElements[optionElements.length - 1]).toHaveClass(
        "bg-purple-300/40",
      );
    });

    it("navigates to first item with Home", async () => {
      const user = setupUser();
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} editMode={false} />,
      );
      rerender(<FilterableSelectCell {...defaultProps} editMode="full" />);

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
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} editMode={false} />,
      );
      rerender(<FilterableSelectCell {...defaultProps} editMode="full" />);

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
      // Render closed first to initialize activeIndex based on value (1 = Pattern A, index 1)
      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          onChange={onChange}
          editMode={false}
        />,
      );
      rerender(
        <FilterableSelectCell
          {...defaultProps}
          onChange={onChange}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Starting at index 1 (Pattern A), ArrowDown goes to index 2 (Pattern B, value=2)
      await user.keyboard("{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it("selects option on click", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          onChange={onChange}
          editMode={false}
        />,
      );
      rerender(
        <FilterableSelectCell
          {...defaultProps}
          onChange={onChange}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Pattern C"));

      expect(onChange).toHaveBeenCalledWith(3);
    });

    it("calls stopEditing after selection", async () => {
      const user = setupUser();
      const stopEditing = vi.fn();
      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          stopEditing={stopEditing}
          editMode={false}
        />,
      );
      rerender(
        <FilterableSelectCell
          {...defaultProps}
          stopEditing={stopEditing}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Pattern C"));

      expect(stopEditing).toHaveBeenCalled();
    });

    it("commits selection on Tab key", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      // Render closed first to initialize activeIndex based on value (1 = Pattern A, index 1)
      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          onChange={onChange}
          editMode={false}
        />,
      );
      rerender(
        <FilterableSelectCell
          {...defaultProps}
          onChange={onChange}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Starting at index 1 (Pattern A), ArrowDown goes to index 2 (Pattern B, value=2)
      await user.keyboard("{ArrowDown}{Tab}");

      expect(onChange).toHaveBeenCalledWith(2);
    });
  });

  describe("closing popover", () => {
    it("calls stopEditing on Escape (no search)", async () => {
      const user = setupUser();
      const stopEditing = vi.fn();
      render(
        <FilterableSelectCell
          {...defaultProps}
          stopEditing={stopEditing}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      expect(stopEditing).toHaveBeenCalled();
    });

    it("commits on Tab (stopEditing handled by grid)", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      render(
        <FilterableSelectCell
          {...defaultProps}
          onChange={onChange}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{Tab}");

      expect(onChange).toHaveBeenCalledWith(1); // Current value is 1 (Pattern A)
    });

    it("clicking trigger while open calls stopEditing and does not call startEditing after close", async () => {
      const user = setupUser();
      const stopEditing = vi.fn();
      const startEditing = vi.fn();

      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          stopEditing={stopEditing}
          startEditing={startEditing}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Click the trigger button while popover is open
      await user.click(screen.getByRole("button"));

      // Should call stopEditing exactly once
      expect(stopEditing).toHaveBeenCalledTimes(1);

      // Clear mocks to check what happens on rerender
      stopEditing.mockClear();
      startEditing.mockClear();

      // Simulate the grid responding by setting editMode=false
      rerender(
        <FilterableSelectCell
          {...defaultProps}
          stopEditing={stopEditing}
          startEditing={startEditing}
          editMode={false}
        />,
      );

      // Popover should be closed
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // startEditing should NOT have been called after the rerender
      expect(startEditing).not.toHaveBeenCalled();
      // stopEditing should NOT have been called again
      expect(stopEditing).not.toHaveBeenCalled();
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
      render(<FilterableSelectCell {...searchProps} editMode="full" />);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });

    it("filters options based on search query", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} editMode="full" />);

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

    it("highlights first match when typing in search", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} editMode="full" />);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "Pattern");

      await waitFor(() => {
        const optionElements = screen.getAllByRole("option");
        // First match (Pattern A) should be highlighted
        expect(optionElements[0]).toHaveClass("bg-purple-300/40");
        expect(optionElements[0]).toHaveTextContent("Pattern A");
      });
    });

    it("shows all options when search is cleared", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} editMode="full" />);

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
      // Render closed first to initialize state
      const { rerender } = render(
        <FilterableSelectCell {...searchProps} editMode={false} />,
      );
      rerender(<FilterableSelectCell {...searchProps} editMode="full" />);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Start navigating - starting at index 1 (value=1), ArrowDown goes to index 2
      await user.keyboard("{ArrowDown}");

      // Index 2 option should be highlighted
      const optionElements = screen.getAllByRole("option");
      expect(optionElements[2]).toHaveClass("bg-purple-300/40");

      // Escape should return to search mode (not close)
      await user.keyboard("{Escape}");

      // Popover should still be open (stopEditing is mocked)
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("typing while navigating returns to search mode", async () => {
      const user = setupUser();
      render(<FilterableSelectCell {...searchProps} editMode="full" />);

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
    it("focuses button when isActive prop is true", () => {
      render(<FilterableSelectCell {...defaultProps} isActive={true} />);

      const button = screen.getByRole("button");
      expect(document.activeElement).toBe(button);
    });

    it("popover closes when editMode becomes false", async () => {
      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          isActive={true}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      rerender(
        <FilterableSelectCell
          {...defaultProps}
          isActive={true}
          editMode={false}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });

  describe("typeahead on trigger", () => {
    it("opens popover and pre-fills search when typing on trigger (with search)", async () => {
      const user = setupUser();
      const startEditing = vi.fn();
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

      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          options={manyOptions}
          minOptionsForSearch={8}
          startEditing={startEditing}
          editMode={false}
        />,
      );

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("P");

      // Should have called startEditing
      expect(startEditing).toHaveBeenCalled();

      // Simulate the grid setting editMode="full"
      rerender(
        <FilterableSelectCell
          {...defaultProps}
          options={manyOptions}
          minOptionsForSearch={8}
          startEditing={startEditing}
          editMode="full"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Search input should have the typed character
      const searchInput = screen.getByPlaceholderText("Search...");
      expect(searchInput).toHaveValue("P");
    });

    it("typeahead highlights matching option when search is disabled", async () => {
      const user = setupUser();
      const startEditing = vi.fn();
      const { rerender } = render(
        <FilterableSelectCell
          {...defaultProps}
          value={null}
          startEditing={startEditing}
          editMode={false}
          minOptionsForSearch={999} // Disable search
        />,
      );

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("P");

      // Should have called startEditing
      expect(startEditing).toHaveBeenCalled();

      // Simulate the grid setting editMode="full"
      rerender(
        <FilterableSelectCell
          {...defaultProps}
          value={null}
          startEditing={startEditing}
          editMode="full"
          minOptionsForSearch={999}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Pattern A (first option starting with "P") should be highlighted
      const optionElements = screen.getAllByRole("option");
      const patternA = optionElements.find(
        (el) => el.textContent === "Pattern A",
      );
      expect(patternA).toHaveClass("bg-purple-300/40");
    });

    it("typeahead in open popover (no search) highlights matching option", async () => {
      const user = setupUser();
      render(
        <FilterableSelectCell
          {...defaultProps}
          value={null}
          editMode="full"
          minOptionsForSearch={999}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Type "C" to match "CONSTANT"
      await user.keyboard("C");

      const optionElements = screen.getAllByRole("option");
      const constant = optionElements.find(
        (el) => el.textContent === "CONSTANT",
      );
      expect(constant).toHaveClass("bg-purple-300/40");
    });
  });

  describe("selected option indicator", () => {
    it("shows checkmark on currently selected option", async () => {
      render(
        <FilterableSelectCell {...defaultProps} value={2} editMode="full" />,
      );

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

    it("highlights selected option when popover opens", async () => {
      // Render closed first to initialize activeIndex based on value
      const { rerender } = render(
        <FilterableSelectCell {...defaultProps} value={2} editMode={false} />,
      );
      rerender(
        <FilterableSelectCell {...defaultProps} value={2} editMode="full" />,
      );

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Pattern B (value=2, index=2) should be highlighted since it's the current value
      const optionElements = screen.getAllByRole("option");
      const patternB = optionElements.find(
        (el) => el.textContent === "Pattern B",
      );
      expect(patternB).toHaveClass("bg-purple-300/40");
    });
  });

  describe("read-only mode", () => {
    it("displays only the label without dropdown button when readOnly is true", () => {
      render(<FilterableSelectCell {...defaultProps} value={1} readOnly />);

      // Should show the label
      expect(screen.getByText("Pattern A")).toBeInTheDocument();

      // Should not have a button (dropdown trigger)
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("displays empty content when no value is selected in readOnly mode", () => {
      const { container } = render(
        <FilterableSelectCell {...defaultProps} value={null} readOnly />,
      );

      // Should not show the placeholder in readOnly mode
      expect(screen.queryByText("Select...")).not.toBeInTheDocument();
      // Should have empty span
      const span = container.querySelector("span");
      expect(span?.textContent).toBe("");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("does not open dropdown when clicked in readOnly mode", async () => {
      const user = setupUser();
      const { container } = render(
        <FilterableSelectCell {...defaultProps} value={1} readOnly />,
      );

      // Click the cell
      await user.click(container.firstChild as HTMLElement);

      // Should not find a listbox (dropdown should not open)
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("does not call onChange in readOnly mode", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const { container } = render(
        <FilterableSelectCell
          {...defaultProps}
          value={1}
          readOnly
          onChange={onChange}
        />,
      );

      // Try to interact with the cell
      await user.click(container.firstChild as HTMLElement);

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
