import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  SearchableMultiSelector,
  type SearchResults,
} from "./searchable-multi-selector";

const FRUITS = ["Apple", "Apricot", "Banana", "Cherry"];

const searchFruits = (query: string): Promise<SearchResults<string>> => {
  if (query === "many") {
    return Promise.resolve({
      options: [{ value: "Apple", label: "Apple" }],
      complete: false,
    });
  }
  const needle = query.toLowerCase();
  return Promise.resolve({
    options: FRUITS.filter((fruit) => fruit.toLowerCase().includes(needle)).map(
      (fruit) => ({ value: fruit, label: fruit }),
    ),
    complete: true,
  });
};

function Harness({
  initial = [],
  onSearch = searchFruits,
}: {
  initial?: string[];
  onSearch?: (
    query: string,
    signal: AbortSignal,
  ) => Promise<SearchResults<string>>;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <SearchableMultiSelector
      ariaLabel="Fruits"
      selected={selected}
      onChange={setSelected}
      onSearch={onSearch}
      valueLabel={selected.join(", ")}
      placeholder="Choose…"
      partialResultsLabel="Keep typing"
      searchDebounceMs={0}
    />
  );
}

const open = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Fruits" }));
  await waitFor(() => {
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
  return user;
};

const optionNames = () =>
  screen.getAllByRole("option").map((option) => option.textContent);

describe("SearchableMultiSelector", () => {
  it("shows the placeholder, then searches for the empty query on open", async () => {
    render(<Harness />);
    expect(screen.getByRole("combobox", { name: "Fruits" })).toHaveTextContent(
      "Choose…",
    );

    await open();

    await waitFor(() => {
      expect(optionNames()).toEqual(FRUITS);
    });
    expect(screen.getAllByRole("combobox")[1]).toHaveFocus();
  });

  it("narrows the options as the user types", async () => {
    render(<Harness />);
    const user = await open();

    await user.keyboard("ap");

    await waitFor(() => {
      expect(optionNames()).toEqual(["Apple", "Apricot"]);
    });
  });

  it("toggles an option without closing, and lists the selected ones first", async () => {
    render(<Harness />);
    const user = await open();
    await waitFor(() => expect(optionNames()).toEqual(FRUITS));

    await user.click(screen.getByRole("option", { name: "Cherry" }));

    expect(optionNames()).toEqual(["Cherry", "Apple", "Apricot", "Banana"]);
    expect(screen.getByRole("option", { name: "Cherry" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Cherry");
  });

  it("keeps the selected options listed whatever the query", async () => {
    render(<Harness initial={["Banana"]} />);
    const user = await open();

    await user.keyboard("ap");

    await waitFor(() => {
      expect(optionNames()).toEqual(["Banana", "Apple", "Apricot"]);
    });
  });

  it("asks for a narrower query instead of showing a partial result", async () => {
    render(<Harness initial={["Banana"]} />);
    const user = await open();

    await user.keyboard("many");

    await waitFor(() => {
      expect(screen.getByText("Keep typing")).toBeInTheDocument();
    });
    expect(optionNames()).toEqual(["Banana"]);
  });

  it("says when nothing matches", async () => {
    render(<Harness />);
    const user = await open();

    await user.keyboard("zz");

    await waitFor(() => {
      expect(screen.getByText("No results")).toBeInTheDocument();
    });
  });

  it("aborts a search once the query changes", async () => {
    const signals: AbortSignal[] = [];
    const slowSearch = (query: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<SearchResults<string>>((resolve) =>
        setTimeout(() => resolve({ options: [], complete: true }), 50),
      ).then(() => searchFruits(query));
    };
    render(<Harness onSearch={slowSearch} />);
    const user = await open();

    await user.keyboard("a");

    expect(signals[0].aborted).toBe(true);
  });

  it("renders only the rows in view above 100 options", async () => {
    const many = Array.from(
      { length: 500 },
      (_, index) => `Option ${index + 1}`,
    );
    render(
      <Harness
        onSearch={() =>
          Promise.resolve({
            options: many.map((value) => ({ value, label: value })),
            complete: true,
          })
        }
      />,
    );
    await open();

    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByRole("option").length).toBeLessThan(500);
  });

  it("toggles a row outside the rendered window from the keyboard", async () => {
    const many = Array.from(
      { length: 500 },
      (_, index) => `Option ${index + 1}`,
    );
    render(
      <Harness
        onSearch={() =>
          Promise.resolve({
            options: many.map((value) => ({ value, label: value })),
            complete: true,
          })
        }
      />,
    );
    const user = await open();
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Option 500")).not.toBeInTheDocument();
    await user.keyboard("{ArrowUp}{Enter}");

    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Option 500");
  });

  it("toggles the highlighted option with Enter and closes with Escape, back on the trigger", async () => {
    render(<Harness />);
    const user = await open();
    await waitFor(() => expect(optionNames()).toEqual(FRUITS));

    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Apple");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("combobox", { name: "Fruits" })).toHaveFocus();
  });
});
