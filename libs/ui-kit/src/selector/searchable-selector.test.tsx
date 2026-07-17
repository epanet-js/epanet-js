import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableSelector } from "./searchable-selector";

type Option = { id: string; label: string };

const options: Option[] = [
  { id: "a", label: "Apple" },
  { id: "b", label: "Banana" },
];

const search = (query: string): Promise<Option[]> =>
  Promise.resolve(
    options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())),
  );

const openSuggestions = async (label = "Fruit") => {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: label }), "an");
  await waitFor(() => {
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
  return user;
};

describe("SearchableSelector", () => {
  describe("debounced search", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const typeQuery = (value: string) => {
      fireEvent.change(screen.getByRole("textbox", { name: "Fruit" }), {
        target: { value },
      });
    };

    it("waits for the debounce before searching once", async () => {
      const onSearch = vi.fn(search);
      render(
        <SearchableSelector<Option>
          label="Fruit"
          onChange={vi.fn()}
          onSearch={onSearch}
          searchDebounceMs={300}
        />,
      );

      typeQuery("ban");
      expect(onSearch).not.toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(300));

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith("ban");
      expect(screen.getByText("Banana")).toBeInTheDocument();
    });

    it("shows the loading label while debouncing and searching", async () => {
      let resolveSearch: (results: Option[]) => void = () => {};
      const onSearch = vi.fn(
        () =>
          new Promise<Option[]>((resolve) => {
            resolveSearch = resolve;
          }),
      );
      render(
        <SearchableSelector<Option>
          label="Fruit"
          onChange={vi.fn()}
          onSearch={onSearch}
          searchDebounceMs={300}
        />,
      );

      typeQuery("an");
      expect(screen.getByText("Loading...")).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(screen.getByText("Loading...")).toBeInTheDocument();

      await act(async () => {
        resolveSearch(options);
        await Promise.resolve();
      });

      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      expect(screen.getByText("Apple")).toBeInTheDocument();
    });

    it("only searches with the latest query when typing fast", async () => {
      const onSearch = vi.fn(search);
      render(
        <SearchableSelector<Option>
          label="Fruit"
          onChange={vi.fn()}
          onSearch={onSearch}
          searchDebounceMs={300}
        />,
      );

      typeQuery("ba");
      await act(() => vi.advanceTimersByTimeAsync(100));
      typeQuery("bana");
      await act(() => vi.advanceTimersByTimeAsync(300));

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith("bana");
    });

    it("does not show the loading label when not debounced", () => {
      const onSearch = vi.fn(() => new Promise<Option[]>(() => {}));
      render(
        <SearchableSelector<Option>
          label="Fruit"
          onChange={vi.fn()}
          onSearch={onSearch}
        />,
      );

      typeQuery("an");

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("cancels a pending search when the query is cleared", async () => {
      const onSearch = vi.fn(search);
      render(
        <SearchableSelector<Option>
          label="Fruit"
          onChange={vi.fn()}
          onSearch={onSearch}
          searchDebounceMs={300}
        />,
      );

      typeQuery("ban");
      typeQuery("");
      await act(() => vi.advanceTimersByTimeAsync(300));

      expect(onSearch).not.toHaveBeenCalled();
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  describe("side placement", () => {
    it("pins the dropdown to the given side", async () => {
      render(
        <SearchableSelector<Option>
          label="Fruit"
          onChange={vi.fn()}
          onSearch={search}
          side="top"
        />,
      );
      await openSuggestions();

      expect(
        screen.getByRole("listbox").closest("[data-side]"),
      ).toHaveAttribute("data-side", "top");
    });

    it("defaults to opening below the trigger", async () => {
      render(
        <SearchableSelector<Option>
          label="Fruit"
          onChange={vi.fn()}
          onSearch={search}
        />,
      );
      await openSuggestions();

      expect(
        screen.getByRole("listbox").closest("[data-side]"),
      ).toHaveAttribute("data-side", "bottom");
    });
  });
});
