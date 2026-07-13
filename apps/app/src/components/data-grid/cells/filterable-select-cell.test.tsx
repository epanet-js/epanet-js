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
      expect(column.meta!.copyValue!(1)).toBe("Pattern A");
      expect(column.meta!.copyValue!(2)).toBe("Pattern B");
      expect(column.meta!.copyValue!(0)).toBe("CONSTANT");
    });

    it("returns empty string for non-matching value", () => {
      expect(column.meta!.copyValue!(999)).toBe("");
    });

    it("returns empty string for null/undefined", () => {
      expect(column.meta!.copyValue!(null)).toBe("");
      expect(column.meta!.copyValue!(undefined)).toBe("");
    });
  });

  describe("pasteValue", () => {
    it("matches by label (case-insensitive)", () => {
      expect(column.meta!.pasteValue!("Pattern A", {} as any)).toBe(1);
      expect(column.meta!.pasteValue!("pattern a", {} as any)).toBe(1);
      expect(column.meta!.pasteValue!("PATTERN A", {} as any)).toBe(1);
      expect(column.meta!.pasteValue!("constant", {} as any)).toBe(0);
    });

    it("matches by value string", () => {
      expect(column.meta!.pasteValue!("0", {} as any)).toBe(0);
      expect(column.meta!.pasteValue!("1", {} as any)).toBe(1);
      expect(column.meta!.pasteValue!("2", {} as any)).toBe(2);
    });

    it("returns undefined for non-matching value (skip cell)", () => {
      expect(
        column.meta!.pasteValue!("nonexistent", {} as any),
      ).toBeUndefined();
      expect(column.meta!.pasteValue!("999", {} as any)).toBeUndefined();
    });
  });

  describe("copy/paste round-trip", () => {
    it("preserves value through copy then paste", () => {
      const originalValue = 1;
      const copied = column.meta!.copyValue!(originalValue);
      const pasted = column.meta!.pasteValue!(copied, {} as any);
      expect(pasted).toBe(originalValue);
    });

    it("preserves all option values through round-trip", () => {
      for (const option of options) {
        const copied = column.meta!.copyValue!(option.value);
        const pasted = column.meta!.pasteValue!(copied, {} as any);
        expect(pasted).toBe(option.value);
      }
    });
  });
});

describe("FilterableSelectCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const options = [
    { value: 0, label: "CONSTANT" },
    { value: 1, label: "Pattern A" },
    { value: 2, label: "Pattern B" },
  ];

  const defaultProps = {
    value: 1 as string | number | boolean | null,
    editMode: false as const,
    onChange: vi.fn(),
    stopEditing: vi.fn(),
    startEditing: vi.fn(),
    row: {},
    rowIndex: 0,
    columnIndex: 0,
    isActive: true,
    readOnly: false,
    options,
    placeholder: "Select...",
    minOptionsForSearch: 8,
  };

  it("renders the selected option label", () => {
    render(<FilterableSelectCell {...defaultProps} />);
    expect(screen.getByText("Pattern A")).toBeInTheDocument();
  });

  it("caps the options list at 5 rows for long lists", async () => {
    const manyOptions = Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: `Pattern ${i}`,
    }));
    render(
      <FilterableSelectCell
        {...defaultProps}
        value={0}
        options={manyOptions}
        editMode="full"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    expect(screen.getByRole("listbox").parentElement).toHaveStyle({
      maxHeight: "11.25rem",
    });
  });

  it("renders the clear button at the bottom when emptyOptionLabel is set", async () => {
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        emptyOptionLabel="None"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "None" })).toBeInTheDocument();
  });

  it("does not render a clear button at the top of the list", async () => {
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        emptyOptionLabel="None"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    const firstOption = screen.getAllByRole("option")[0];
    expect(firstOption).toHaveTextContent("CONSTANT");
  });

  it("commits when clicking the clear button", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        emptyOptionLabel="None"
        onChange={onChange}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "None" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders an action button when actionLabel is set", async () => {
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        actionLabel="Open library"
        onActionClick={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Open library" }),
    ).toBeInTheDocument();
  });

  it("calls onActionClick and stopEditing when the action button is clicked", async () => {
    const user = setupUser();
    const onActionClick = vi.fn();
    const stopEditing = vi.fn();
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        actionLabel="Open library"
        onActionClick={onActionClick}
        stopEditing={stopEditing}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open library" }));

    expect(onActionClick).toHaveBeenCalled();
    expect(stopEditing).toHaveBeenCalled();
  });

  it("shows a create row when allowNew and the query has no exact match", async () => {
    const user = setupUser();
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        allowNew
        minOptionsForSearch={1}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    const search = screen.getByPlaceholderText("Search…");
    await user.type(search, "Brand new");

    expect(screen.getByText(/^Add "Brand new"$/)).toBeInTheDocument();
  });

  it("commits the typed value when Enter is pressed on the create row", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        allowNew
        minOptionsForSearch={1}
        onChange={onChange}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    const search = screen.getByPlaceholderText("Search…");
    await user.type(search, "Brand new");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("Brand new");
  });

  it("Tab does not commit (cycles regions instead)", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(
      <FilterableSelectCell
        {...defaultProps}
        editMode="full"
        onChange={onChange}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{Tab}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("type-to-open seeds the search query from the typed character", async () => {
    const user = setupUser();
    const startEditing = vi.fn();
    const { rerender } = render(
      <FilterableSelectCell
        {...defaultProps}
        startEditing={startEditing}
        minOptionsForSearch={1}
      />,
    );

    const button = screen.getByRole("button");
    button.focus();
    await user.keyboard("p");

    expect(startEditing).toHaveBeenCalled();

    rerender(
      <FilterableSelectCell
        {...defaultProps}
        startEditing={startEditing}
        minOptionsForSearch={1}
        editMode="full"
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search…")).toHaveValue("p");
    });
  });
});
