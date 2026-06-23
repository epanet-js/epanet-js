import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Selector, SelectorOption } from "./selector";

const setupUser = () => userEvent.setup();

const opt = (label: string): SelectorOption<string> => ({
  value: label,
  label,
});

const openSelector = async (label = "Pick one") => {
  const user = setupUser();
  await user.click(screen.getByRole("combobox", { name: label }));
  await waitFor(() => {
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
  return user;
};

describe("Selector", () => {
  describe("rendering (nullable)", () => {
    it("shows the selected option label on the trigger", () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected="Banana"
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
        />,
      );
      expect(
        screen.getByRole("combobox", { name: "Pick one" }),
      ).toHaveTextContent("Banana");
    });

    it("shows the placeholder when nothing is selected", () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
        />,
      );
      expect(
        screen.getByRole("combobox", { name: "Pick one" }),
      ).toHaveTextContent("Choose…");
    });

    it("renders the option's description in preference to its label", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[{ value: "a", label: "A", description: "Apple (desc)" }]}
          selected="a"
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
        />,
      );
      expect(
        screen.getByRole("combobox", { name: "Pick one" }),
      ).toHaveTextContent("Apple (desc)");

      await openSelector();
      expect(
        screen.getByRole("option", { name: "Apple (desc)" }),
      ).toBeInTheDocument();
    });
  });

  describe("rendering (non-nullable)", () => {
    it("shows the selected option label without italic placeholder styling", () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected="Apple"
          onChange={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("combobox", { name: "Pick one" }),
      ).toHaveTextContent("Apple");
    });

    it("supports numeric option values", async () => {
      const onChange = vi.fn();
      render(
        <Selector<number>
          ariaLabel="Pick one"
          options={[
            { value: 1, label: "One" },
            { value: 2, label: "Two" },
          ]}
          selected={1}
          onChange={onChange}
        />,
      );
      const user = await openSelector();
      await user.click(screen.getByRole("option", { name: "Two" }));
      expect(onChange).toHaveBeenCalledWith(2, 1);
    });
  });

  describe("selecting an existing option", () => {
    it("commits the clicked option with (newValue, oldValue)", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected="Apple"
          onChange={onChange}
          nullable
          placeholder="Choose…"
        />,
      );
      const user = await openSelector();

      await user.click(screen.getByRole("option", { name: "Banana" }));

      expect(onChange).toHaveBeenCalledWith("Banana", "Apple");
    });

    it("filters options by search query (allowNew)", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Apricot"), opt("Banana")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          allowNew
        />,
      );
      const user = await openSelector();
      await user.type(screen.getByPlaceholderText("Search…"), "ap");

      const options = screen
        .getAllByRole("option")
        .map((el) => el.textContent ?? "");
      expect(options).toEqual(expect.arrayContaining(["Apple", "Apricot"]));
      expect(options).not.toContain("Banana");
    });

    it("commits the highlighted option on Enter", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected={null}
          onChange={onChange}
          nullable
          placeholder="Choose…"
        />,
      );
      const user = await openSelector();
      await user.keyboard("{ArrowDown}{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith("Banana", null);
    });
  });

  describe("disabled options", () => {
    it("does not commit when a disabled option is clicked", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[
            opt("Apple"),
            { value: "Banana", label: "Banana", disabled: true },
          ]}
          selected="Apple"
          onChange={onChange}
        />,
      );
      const user = await openSelector();
      await user.click(screen.getByRole("option", { name: "Banana" }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("skips disabled options during keyboard navigation", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[
            opt("Apple"),
            { value: "Banana", label: "Banana", disabled: true },
            opt("Cherry"),
          ]}
          selected="Apple"
          onChange={onChange}
        />,
      );
      const user = await openSelector();
      await user.keyboard("{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledWith("Cherry", "Apple");
    });
  });

  describe("clearLabel (nullable only)", () => {
    it("renders the clear button when a value is selected", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected="Apple"
          onChange={onChange}
          nullable
          placeholder="Choose…"
          clearLabel="Clear selection"
        />,
      );
      await openSelector();

      await setupUser().click(
        screen.getByRole("button", { name: "Clear selection" }),
      );

      expect(onChange).toHaveBeenCalledWith(null, "Apple");
    });

    it("renders the clear button even when nothing is selected", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          clearLabel="Clear selection"
        />,
      );
      await openSelector();

      expect(
        screen.getByRole("button", { name: "Clear selection" }),
      ).toBeInTheDocument();
    });

    it("does not render the clear button when there are no options at all", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          clearLabel="Clear selection"
        />,
      );
      // No options → the trigger is disabled, so clicking it does nothing and
      // the clear button never renders.
      const user = setupUser();
      await user.click(screen.getByRole("combobox", { name: "Pick one" }));

      expect(
        screen.queryByRole("button", { name: "Clear selection" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("actionLabel", () => {
    it("renders an action row and fires onActionClick", async () => {
      const onActionClick = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected="Apple"
          onChange={vi.fn()}
          actionLabel="Open library"
          onActionClick={onActionClick}
        />,
      );
      await openSelector();

      await setupUser().click(
        screen.getByRole("button", { name: "Open library" }),
      );

      expect(onActionClick).toHaveBeenCalledTimes(1);
    });

    it("renders the action row regardless of selection state", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          actionLabel="Open library"
          onActionClick={vi.fn()}
        />,
      );
      await openSelector();

      expect(
        screen.getByRole("button", { name: "Open library" }),
      ).toBeInTheDocument();
    });
  });

  describe("allowNew (default: false)", () => {
    it('does not show "Add X" by default', async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[
            opt("A"),
            opt("B"),
            opt("C"),
            opt("D"),
            opt("E"),
            opt("F"),
            opt("G"),
            opt("H"),
          ]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
        />,
      );
      const user = await openSelector();
      await user.type(screen.getByPlaceholderText("Search…"), "ZZZ");

      expect(screen.queryByText(/^Add "/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });

    it('shows "Add X" when allowNew=true and the query has no exact match', async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          allowNew
        />,
      );
      const user = await openSelector();
      await user.type(screen.getByPlaceholderText("Search…"), "Cherry");

      expect(screen.getByText('Add "Cherry"')).toBeInTheDocument();
    });

    it("commits the typed value when clicking the create option", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected={null}
          onChange={onChange}
          nullable
          placeholder="Choose…"
          allowNew
        />,
      );
      const user = await openSelector();
      await user.type(screen.getByPlaceholderText("Search…"), "Cherry");
      await user.click(screen.getByText('Add "Cherry"'));

      expect(onChange).toHaveBeenCalledWith("Cherry", null);
    });

    it('does not show "Add X" when the query exactly matches an existing option', async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          allowNew
        />,
      );
      const user = await openSelector();
      await user.type(screen.getByPlaceholderText("Search…"), "apple");

      expect(screen.queryByText(/^Add "/)).not.toBeInTheDocument();
    });
  });

  describe("minOptionsForSearch (default: 8)", () => {
    it("hides the search input when allowNew=false and options below threshold", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana"), opt("Cherry")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
        />,
      );
      await openSelector();

      expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
    });

    it("shows the search input when options meet the threshold", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[
            opt("A"),
            opt("B"),
            opt("C"),
            opt("D"),
            opt("E"),
            opt("F"),
            opt("G"),
            opt("H"),
          ]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
        />,
      );
      await openSelector();

      expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    });

    it("respects a custom minOptionsForSearch threshold", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("A"), opt("B"), opt("C")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          minOptionsForSearch={3}
        />,
      );
      await openSelector();

      expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    });

    it("always shows the search input when allowNew=true", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          allowNew
        />,
      );
      await openSelector();

      expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    });

    it("supports arrow-key navigation and Enter when the search input is hidden", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected={null}
          onChange={onChange}
          nullable
          placeholder="Choose…"
        />,
      );
      const user = await openSelector();

      await user.keyboard("{ArrowDown}{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith("Banana", null);
    });
  });

  describe("disabled component", () => {
    it("does not open the popover when the trigger is clicked", async () => {
      const user = setupUser();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple")]}
          selected="Apple"
          onChange={vi.fn()}
          disabled
        />,
      );
      await user.click(screen.getByRole("combobox", { name: "Pick one" }));

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("is disabled and does not open when there are no options", async () => {
      const user = setupUser();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          clearLabel="Clear selection"
        />,
      );
      const trigger = screen.getByRole("combobox", { name: "Pick one" });
      expect(trigger).toBeDisabled();

      await user.click(trigger);

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("stays enabled with no options when an action is available", async () => {
      const user = setupUser();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          actionLabel="Open library"
          onActionClick={vi.fn()}
        />,
      );
      const trigger = screen.getByRole("combobox", { name: "Pick one" });
      expect(trigger).not.toBeDisabled();

      await user.click(trigger);

      expect(
        screen.getByRole("button", { name: "Open library" }),
      ).toBeInTheDocument();
    });

    it("stays enabled with no options when allowNew is set", () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          allowNew
        />,
      );

      expect(
        screen.getByRole("combobox", { name: "Pick one" }),
      ).not.toBeDisabled();
    });
  });

  describe("keyboard interaction", () => {
    it("triggers the action on Enter when no options exist", async () => {
      const onActionClick = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          actionLabel="Open library"
          onActionClick={onActionClick}
        />,
      );
      const user = setupUser();
      await user.click(screen.getByRole("combobox", { name: "Pick one" }));
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Open library" }),
        ).toBeInTheDocument();
      });
      await user.keyboard("{Enter}");

      expect(onActionClick).toHaveBeenCalled();
    });

    it("Tab from the list jumps the active highlight to the clear button", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected="Apple"
          onChange={onChange}
          nullable
          placeholder="Choose…"
          clearLabel="None"
        />,
      );
      const user = await openSelector();
      await user.keyboard("{Tab}{Enter}");

      expect(onChange).toHaveBeenCalledWith(null, "Apple");
    });

    it("Tab cycles through search when present", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[
            opt("A"),
            opt("B"),
            opt("C"),
            opt("D"),
            opt("E"),
            opt("F"),
            opt("G"),
            opt("H"),
          ]}
          selected={null}
          onChange={vi.fn()}
          nullable
          placeholder="Choose…"
          actionLabel="Open library"
          onActionClick={vi.fn()}
        />,
      );
      const user = await openSelector();
      // Open with search focused. Tab → options. Tab → action. Tab → back to search.
      const search = screen.getByPlaceholderText("Search…");
      expect(search).toHaveFocus();
      await user.keyboard("{Tab}{Tab}{Tab}");
      expect(search).toHaveFocus();
    });

    it("Shift+Tab from a button goes back to the last option", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected="Apple"
          onChange={onChange}
          nullable
          placeholder="Choose…"
          clearLabel="None"
        />,
      );
      const user = await openSelector();
      // Tab → clear button. Shift+Tab → last option (Banana). Enter → commit Banana.
      await user.keyboard("{Tab}{Shift>}{Tab}{/Shift}{Enter}");

      expect(onChange).toHaveBeenCalledWith("Banana", "Apple");
    });

    it("navigates into the action button via Arrow keys and Enter triggers it", async () => {
      const onActionClick = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected="Apple"
          onChange={vi.fn()}
          actionLabel="Open library"
          onActionClick={onActionClick}
        />,
      );
      const user = await openSelector();
      // Active starts on "Apple" (index 0). ArrowDown twice → action row.
      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

      expect(onActionClick).toHaveBeenCalled();
    });

    it("type-ahead jumps the active row to the first matching option (no search)", async () => {
      const onChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana"), opt("Cherry")]}
          selected="Apple"
          onChange={onChange}
        />,
      );
      const user = await openSelector();
      await user.keyboard("c{Enter}");

      expect(onChange).toHaveBeenCalledWith("Cherry", "Apple");
    });

    it("type-ahead focuses the search input and appends the typed character", async () => {
      render(
        <Selector
          ariaLabel="Pick one"
          options={[
            opt("A"),
            opt("B"),
            opt("C"),
            opt("D"),
            opt("E"),
            opt("F"),
            opt("G"),
            opt("H"),
          ]}
          selected="A"
          onChange={vi.fn()}
        />,
      );
      const user = setupUser();
      await user.click(screen.getByRole("combobox", { name: "Pick one" }));
      // Search input exists (>= minOptionsForSearch). Focus is initially on it; tab to listbox first.
      const list = screen.getByRole("listbox");
      list.focus();
      await user.keyboard("d");

      const search = screen.getByPlaceholderText("Search…");
      expect(search).toHaveValue("d");
    });
  });

  describe("onActiveOptionChange", () => {
    it("reports the option under the cursor and clears on close", async () => {
      const onActiveOptionChange = vi.fn();
      render(
        <Selector
          ariaLabel="Pick one"
          options={[opt("Apple"), opt("Banana")]}
          selected="Apple"
          onChange={vi.fn()}
          onActiveOptionChange={onActiveOptionChange}
        />,
      );
      const user = await openSelector();

      expect(onActiveOptionChange).toHaveBeenCalledWith("Apple");

      await user.hover(screen.getByRole("option", { name: "Banana" }));
      expect(onActiveOptionChange).toHaveBeenLastCalledWith("Banana");

      await user.click(screen.getByRole("option", { name: "Banana" }));
      expect(onActiveOptionChange).toHaveBeenLastCalledWith(null);
    });
  });
});
