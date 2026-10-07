import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MultiSelector, MultiSelectorOption } from "./multi-selector";

const setupUser = () => userEvent.setup();

const opt = (label: string): MultiSelectorOption<string> => ({
  value: label,
  label,
});

const manyOpts = (count: number): MultiSelectorOption<string>[] =>
  Array.from({ length: count }, (_, i) => opt(`Option ${i + 1}`));

const openMultiSelector = async (label = "Pick some") => {
  const user = setupUser();
  await user.click(screen.getByRole("combobox", { name: label }));
  await waitFor(() => {
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
  return user;
};

/** Controlled harness so re-renders reflect the updated `selected`. */
function Harness({
  options,
  initial = [],
  valueLabel,
  placeholder = "Choose…",
  minOptionsForSearch,
  maxVisibleOptions,
  side,
}: {
  options: MultiSelectorOption<string>[];
  initial?: string[];
  valueLabel?: (selected: string[]) => string;
  placeholder?: string;
  minOptionsForSearch?: number;
  maxVisibleOptions?: number;
  side?: "top" | "bottom" | "auto";
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <MultiSelector
      ariaLabel="Pick some"
      options={options}
      selected={selected}
      onChange={setSelected}
      valueLabel={
        valueLabel ? valueLabel(selected) : `${selected.length} selected`
      }
      placeholder={placeholder}
      minOptionsForSearch={minOptionsForSearch}
      maxVisibleOptions={maxVisibleOptions}
      side={side}
    />
  );
}

describe("MultiSelector", () => {
  describe("trigger", () => {
    it("shows the placeholder when nothing is selected", () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      expect(
        screen.getByRole("combobox", { name: "Pick some" }),
      ).toHaveTextContent("Choose…");
    });

    it("shows the value label when something is selected", () => {
      render(
        <Harness options={[opt("Apple"), opt("Banana")]} initial={["Apple"]} />,
      );
      expect(
        screen.getByRole("combobox", { name: "Pick some" }),
      ).toHaveTextContent("1 selected");
    });

    it("disables the trigger when there are no options", () => {
      render(<Harness options={[]} />);
      expect(
        screen.getByRole("combobox", { name: "Pick some" }),
      ).toBeDisabled();
    });
  });

  describe("list", () => {
    it("renders a multiselectable listbox with one option per entry", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      await openMultiSelector();
      expect(screen.getByRole("listbox")).toHaveAttribute(
        "aria-multiselectable",
        "true",
      );
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    it("reflects selected state via aria-selected", async () => {
      render(
        <Harness
          options={[opt("Apple"), opt("Banana")]}
          initial={["Banana"]}
        />,
      );
      await openMultiSelector();
      expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  describe("toggling", () => {
    it("selects an unselected option and keeps the popover open", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      const user = await openMultiSelector();
      await user.click(screen.getByRole("option", { name: "Apple" }));
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(
        screen.getByRole("combobox", { name: "Pick some" }),
      ).toHaveTextContent("1 selected");
    });

    it("deselects an already-selected option", async () => {
      render(
        <Harness options={[opt("Apple"), opt("Banana")]} initial={["Apple"]} />,
      );
      const user = await openMultiSelector();
      await user.click(screen.getByRole("option", { name: "Apple" }));
      expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(
        screen.getByRole("combobox", { name: "Pick some" }),
      ).toHaveTextContent("Choose…");
    });

    it("toggles the active option with Enter and stays open", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      const user = await openMultiSelector();
      await user.keyboard("{ArrowDown}{Enter}");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  describe("search", () => {
    it("does not show a search box below the threshold", async () => {
      render(<Harness options={manyOpts(7)} />);
      await openMultiSelector();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("shows a search box at the default threshold of 8", async () => {
      render(<Harness options={manyOpts(8)} />);
      await openMultiSelector();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("respects a custom minOptionsForSearch", async () => {
      render(<Harness options={manyOpts(3)} minOptionsForSearch={3} />);
      await openMultiSelector();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("filters options case-insensitively by label", async () => {
      render(
        <Harness
          options={[...manyOpts(7), opt("Zebra")]}
          minOptionsForSearch={8}
        />,
      );
      const user = await openMultiSelector();
      await user.type(screen.getByRole("textbox"), "zeb");
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByRole("option", { name: "Zebra" })).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("skips disabled options with ArrowDown", async () => {
      render(
        <Harness
          options={[
            opt("Apple"),
            { value: "Banana", label: "Banana", disabled: true },
            opt("Cherry"),
          ]}
        />,
      );
      const user = await openMultiSelector();
      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
      expect(screen.getByRole("option", { name: "Cherry" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("toggles the highlighted option with Space and stays open", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      const user = await openMultiSelector();
      await user.keyboard("{ArrowDown}{ArrowDown} ");

      expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("types a space into the search box instead of toggling", async () => {
      render(<Harness options={[...manyOpts(7), opt("Option 1 b")]} />);
      const user = await openMultiSelector();
      await user.keyboard("Option 1 ");

      expect(screen.getByRole("textbox")).toHaveValue("Option 1 ");
      expect(
        screen
          .getAllByRole("option")
          .filter((option) => option.getAttribute("aria-selected") === "true"),
      ).toHaveLength(0);
    });

    it("clears the search after toggling with Enter, keeping the option highlighted", async () => {
      render(<Harness options={[...manyOpts(7), opt("Zebra")]} />);
      const user = await openMultiSelector();
      await user.keyboard("Zeb{Enter}");

      expect(screen.getByRole("textbox")).toHaveValue("");
      expect(screen.getAllByRole("option")).toHaveLength(8);
      const zebra = screen.getByRole("option", { name: "Zebra" });
      expect(zebra).toHaveAttribute("aria-selected", "true");
      expect(zebra).toHaveClass("bg-base-hover");
    });

    it("moves the highlight through the options with Tab, staying open", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      const user = await openMultiSelector();
      await user.keyboard("{Tab}{Tab}{Enter}");

      expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("moves between the search box and the options with Tab", async () => {
      render(<Harness options={manyOpts(8)} />);
      const user = await openMultiSelector();

      await user.keyboard("{Tab} ");
      expect(screen.getByRole("option", { name: "Option 1" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await user.keyboard("{Tab}");
      expect(screen.getByRole("textbox")).toHaveFocus();
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("closes the popover on Escape", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      const user = await openMultiSelector();
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });

  describe("atomic callbacks", () => {
    it("calls onOptionSelected with the value when an option is added", async () => {
      const onOptionSelected = vi.fn();
      render(
        <MultiSelector
          ariaLabel="Pick some"
          options={[opt("Apple"), opt("Banana")]}
          selected={[]}
          onOptionSelected={onOptionSelected}
          valueLabel="0 selected"
          placeholder="Choose…"
        />,
      );
      const user = await openMultiSelector();
      await user.click(screen.getByRole("option", { name: "Banana" }));
      expect(onOptionSelected).toHaveBeenCalledWith("Banana");
    });

    it("calls onOptionRemoved with the value when an option is deselected", async () => {
      const onOptionRemoved = vi.fn();
      render(
        <MultiSelector
          ariaLabel="Pick some"
          options={[opt("Apple"), opt("Banana")]}
          selected={["Apple"]}
          onOptionRemoved={onOptionRemoved}
          valueLabel="1 selected"
          placeholder="Choose…"
        />,
      );
      const user = await openMultiSelector();
      await user.click(screen.getByRole("option", { name: "Apple" }));
      expect(onOptionRemoved).toHaveBeenCalledWith("Apple");
    });

    it("still calls onChange alongside the atomic callbacks", async () => {
      const onChange = vi.fn();
      const onOptionSelected = vi.fn();
      render(
        <MultiSelector
          ariaLabel="Pick some"
          options={[opt("Apple"), opt("Banana")]}
          selected={[]}
          onChange={onChange}
          onOptionSelected={onOptionSelected}
          valueLabel="0 selected"
          placeholder="Choose…"
        />,
      );
      const user = await openMultiSelector();
      await user.click(screen.getByRole("option", { name: "Apple" }));
      expect(onChange).toHaveBeenCalledWith(["Apple"]);
      expect(onOptionSelected).toHaveBeenCalledWith("Apple");
    });
  });

  describe("options list height", () => {
    it("caps the scrollable options container at 5.5 rows by default", async () => {
      render(<Harness options={manyOpts(12)} />);
      await openMultiSelector();

      const container = screen.getByRole("listbox").parentElement;
      expect(container).toHaveClass("overflow-auto");
      expect(container).toHaveClass("scroll-shadows");
      expect(container).toHaveStyle({ maxHeight: "11.25rem" });
    });

    it("sizes the cap from maxVisibleOptions", async () => {
      render(<Harness options={manyOpts(12)} maxVisibleOptions={3} />);
      await openMultiSelector();

      expect(screen.getByRole("listbox").parentElement).toHaveStyle({
        maxHeight: "7.25rem",
      });
    });
  });

  describe("focus after closing", () => {
    const renderWithNeighbour = () =>
      render(
        <>
          <Harness options={[opt("Apple"), opt("Banana")]} />
          <button type="button">Elsewhere</button>
        </>,
      );

    it("returns focus to the trigger when closed with Escape", async () => {
      renderWithNeighbour();
      const user = await openMultiSelector();
      await user.keyboard("{ArrowDown}{Enter}{Escape}");

      await waitFor(() => {
        expect(
          screen.getByRole("combobox", { name: "Pick some" }),
        ).toHaveFocus();
      });
    });

    it("leaves focus where the user clicked when closed from outside", async () => {
      renderWithNeighbour();
      const user = await openMultiSelector();
      await user.click(screen.getByRole("button", { name: "Elsewhere" }));

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    });
  });

  describe("virtualization", () => {
    it("renders only the rows in view above 100 options", async () => {
      render(<Harness options={manyOpts(500)} />);
      await openMultiSelector();

      expect(screen.getAllByRole("option").length).toBeLessThan(500);
    });

    it("toggles a row outside the rendered window from the keyboard", async () => {
      render(
        <Harness
          options={manyOpts(500)}
          valueLabel={(selected) => selected.join(", ")}
        />,
      );
      const user = await openMultiSelector();

      expect(screen.queryByText("Option 500")).not.toBeInTheDocument();
      await user.keyboard("{End}{Enter}");

      expect(
        screen.getByRole("combobox", { name: "Pick some" }),
      ).toHaveTextContent("Option 500");
    });
  });

  describe("side placement", () => {
    it("pins the dropdown to the given side", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} side="top" />);
      await openMultiSelector();

      expect(
        screen.getByRole("listbox").closest("[data-side]"),
      ).toHaveAttribute("data-side", "top");
    });

    it("defaults to opening below the trigger", async () => {
      render(<Harness options={[opt("Apple"), opt("Banana")]} />);
      await openMultiSelector();

      expect(
        screen.getByRole("listbox").closest("[data-side]"),
      ).toHaveAttribute("data-side", "bottom");
    });
  });
});
