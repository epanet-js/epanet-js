import { render, screen, waitFor } from "@testing-library/react";
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
