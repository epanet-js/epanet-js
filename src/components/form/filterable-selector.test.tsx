import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterableSelector } from "./filterable-selector";
import { vi } from "vitest";

const options = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "date", label: "Date" },
  { value: "elderberry", label: "Elderberry" },
];

const getInput = () => screen.getByRole("textbox");

const getOption = (name: string) => screen.getByRole("option", { name });

const getOptions = () => screen.getAllByRole("option");

const queryOptions = () => screen.queryAllByRole("option");

describe("FilterableSelector", () => {
  describe("initialization", () => {
    it("displays the selected option label", () => {
      render(
        <FilterableSelector
          options={options}
          selected="banana"
          onChange={vi.fn()}
        />,
      );

      expect(getInput()).toHaveValue("Banana");
    });

    it("displays empty input when no option is selected", () => {
      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      expect(getInput()).toHaveValue("");
    });

    it("displays placeholder when provided and no option selected", () => {
      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
          placeholder="Select a fruit"
        />,
      );

      expect(getInput()).toHaveAttribute("placeholder", "Select a fruit");
    });

    it("dropdown is closed initially", () => {
      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      expect(queryOptions()).toHaveLength(0);
    });
  });

  describe("opening dropdown", () => {
    it("opens dropdown when input is focused", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());

      expect(getOptions()).toHaveLength(5);
    });

    it("opens dropdown when pressing Enter on closed dropdown", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      getInput().focus();
      await user.keyboard("{Escape}"); // Close if opened by focus
      await user.keyboard("{Enter}");

      expect(getOptions()).toHaveLength(5);
    });

    it("opens dropdown when pressing ArrowDown on closed dropdown", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      getInput().focus();
      await user.keyboard("{Escape}"); // Close if opened by focus
      await user.keyboard("{ArrowDown}");

      expect(getOptions()).toHaveLength(5);
    });
  });

  describe("filtering options", () => {
    it("filters options as user types", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.type(getInput(), "an");

      const visibleOptions = getOptions();
      expect(visibleOptions).toHaveLength(5); // All options shown, but matching first
      expect(visibleOptions[0]).toHaveTextContent("Banana");
    });

    it("shows matching options first, then non-matching", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.type(getInput(), "erry");

      const visibleOptions = getOptions();
      expect(visibleOptions[0]).toHaveTextContent("Cherry");
      expect(visibleOptions[1]).toHaveTextContent("Elderberry");
    });

    it("highlights first matching option when typing", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.type(getInput(), "ban");

      const bananaOption = getOption("Banana");
      expect(bananaOption).toHaveClass("bg-purple-300/40");
    });

    it("does not highlight any option when input is empty", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());

      const visibleOptions = getOptions();
      visibleOptions.forEach((option) => {
        expect(option).not.toHaveClass("bg-purple-300/40");
      });
    });
  });

  describe("keyboard navigation", () => {
    it("navigates down with ArrowDown", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}");

      expect(getOption("Apple")).toHaveClass("bg-purple-300/40");
    });

    it("navigates up with ArrowUp", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");

      expect(getOption("Apple")).toHaveClass("bg-purple-300/40");
    });

    it("wraps to last option when pressing ArrowUp from first option", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}{ArrowUp}");

      expect(getOption("Elderberry")).toHaveClass("bg-purple-300/40");
    });

    it("navigates with Home key to first option", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Home}");

      expect(getOption("Apple")).toHaveClass("bg-purple-300/40");
    });

    it("navigates with End key to last option", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}{End}");

      expect(getOption("Elderberry")).toHaveClass("bg-purple-300/40");
    });

    it("navigates with PageDown key", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{PageDown}");

      // PageDown moves by PAGE_SIZE (5) from -1, so 4 (0-indexed)
      expect(getOption("Elderberry")).toHaveClass("bg-purple-300/40");
    });
  });

  describe("selecting options", () => {
    it("selects option on Enter when one is highlighted", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledWith("banana");
    });

    it("selects option on Tab when one is highlighted", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}{ArrowDown}");
      await user.tab();

      expect(onChange).toHaveBeenCalledWith("banana");
    });

    it("selects option on click", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.click(getOption("Cherry"));

      expect(onChange).toHaveBeenCalledWith("cherry");
    });

    it("selects filtered option when typing and pressing Enter", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.type(getInput(), "ban");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith("banana");
    });

    it("closes dropdown after selection", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.click(getOption("Cherry"));

      expect(queryOptions()).toHaveLength(0);
    });
  });

  describe("closing dropdown without selection", () => {
    it("closes dropdown on Escape", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected="apple"
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      expect(getOptions()).toHaveLength(5);

      await user.keyboard("{Escape}");
      expect(queryOptions()).toHaveLength(0);
    });

    it("closes dropdown and resets input when pressing Enter with no highlight", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected="apple"
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.clear(getInput());
      await user.keyboard("{Enter}");

      expect(queryOptions()).toHaveLength(0);
      expect(getInput()).toHaveValue("Apple");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("resets input to selected value on blur without valid selection", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected="apple"
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.clear(getInput());
      await user.type(getInput(), "xyz");
      await user.tab();

      expect(getInput()).toHaveValue("Apple");
    });
  });

  describe("blur behavior", () => {
    it("commits highlighted option on blur", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected="apple"
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}{ArrowDown}"); // Highlight Banana
      await user.tab();

      expect(onChange).toHaveBeenCalledWith("banana");
    });

    it("calls onChange on Tab even if highlighted option is already selected", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected="apple"
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.keyboard("{ArrowDown}"); // Highlight Apple (already selected)
      await user.tab();

      // Tab commits the highlighted option regardless of current selection
      expect(onChange).toHaveBeenCalledWith("apple");
    });

    it("does not call onChange on blur if no option is highlighted", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={options}
          selected="apple"
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      // Don't highlight any option, just blur
      await user.tab();

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("mouse interactions", () => {
    it("highlights option on mouse enter", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.hover(getOption("Cherry"));

      expect(getOption("Cherry")).toHaveClass("bg-purple-300/40");
    });

    it("shows checkmark for selected option", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected="cherry"
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());

      const cherryOption = getOption("Cherry");
      expect(cherryOption).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("edge cases", () => {
    it("handles empty options list", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector options={[]} selected={null} onChange={vi.fn()} />,
      );

      await user.click(getInput());

      expect(queryOptions()).toHaveLength(0);
    });

    it("handles option with special characters in label", async () => {
      const user = userEvent.setup();
      const specialOptions = [
        { value: "special", label: "Special <Option> & More" },
      ];
      const onChange = vi.fn();

      render(
        <FilterableSelector
          options={specialOptions}
          selected={null}
          onChange={onChange}
        />,
      );

      await user.click(getInput());
      await user.click(getOption("Special <Option> & More"));

      expect(onChange).toHaveBeenCalledWith("special");
    });

    it("updates displayed value when selected prop changes", () => {
      const { rerender } = render(
        <FilterableSelector
          options={options}
          selected="apple"
          onChange={vi.fn()}
        />,
      );

      expect(getInput()).toHaveValue("Apple");

      rerender(
        <FilterableSelector
          options={options}
          selected="banana"
          onChange={vi.fn()}
        />,
      );

      expect(getInput()).toHaveValue("Banana");
    });

    it("case-insensitive filtering", async () => {
      const user = userEvent.setup();

      render(
        <FilterableSelector
          options={options}
          selected={null}
          onChange={vi.fn()}
        />,
      );

      await user.click(getInput());
      await user.type(getInput(), "APPLE");

      const visibleOptions = getOptions();
      expect(visibleOptions[0]).toHaveTextContent("Apple");
    });
  });
});
