import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemandCategoriesEditor } from "./demand-categories-editor";
import { JunctionDemand, PatternId } from "src/hydraulic-model/demands";

const aPatterns = (
  ...patterns: [PatternId, number[]][]
): Map<PatternId, number[]> => {
  return new Map(patterns);
};

const getBaseDemandInput = (rowIndex: number) => {
  const inputs = screen.getAllByRole("textbox");
  return inputs[rowIndex];
};

const getPatternSelector = (rowIndex: number) => {
  const selectors = screen.getAllByRole("combobox");
  return selectors[rowIndex];
};

const getAddRowButton = () => {
  return screen.getByRole("button", { name: /add demand category/i });
};

const getActionsButton = (rowIndex: number) => {
  const buttons = screen.getAllByRole("button", { name: /actions/i });
  return buttons[rowIndex];
};

describe("DemandCategoriesEditor", () => {
  describe("initialization", () => {
    it("shows a default row with base demand 0 and constant pattern when no demands provided", () => {
      render(
        <DemandCategoriesEditor
          demands={[]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
        />,
      );

      expect(getBaseDemandInput(0)).toHaveValue("0");
      expect(getPatternSelector(0)).toHaveTextContent(/constant/i);
    });

    it("displays existing demands", () => {
      const demands: JunctionDemand[] = [
        { baseDemand: 100, patternId: "Pattern1" },
        { baseDemand: 50, patternId: undefined },
      ];

      render(
        <DemandCategoriesEditor
          demands={demands}
          patterns={aPatterns(["Pattern1", [1, 2, 3]])}
          onDemandsChange={vi.fn()}
        />,
      );

      expect(getBaseDemandInput(0)).toHaveValue("100");
      expect(getPatternSelector(0)).toHaveTextContent("Pattern1");
      expect(getBaseDemandInput(1)).toHaveValue("50");
      expect(getPatternSelector(1)).toHaveTextContent(/constant/i);
    });

    it("shows all available patterns in the dropdown", async () => {
      const user = userEvent.setup();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns(["Pattern1", [1]], ["Pattern2", [2]])}
          onDemandsChange={vi.fn()}
        />,
      );

      await user.click(getPatternSelector(0));

      expect(
        screen.getByRole("option", { name: /constant/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Pattern1" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Pattern2" }),
      ).toBeInTheDocument();
    });
  });

  describe("editing base demand", () => {
    it("calls onDemandsChange when base demand is changed", async () => {
      // Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      const input = getBaseDemandInput(0);
      await user.click(input);
      await user.clear(input);
      await user.type(input, "200");
      await user.keyboard("{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 200, patternId: undefined },
      ]);
    });
  });

  describe("editing pattern", () => {
    it("calls onDemandsChange when pattern is changed", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns(["Pattern1", [1, 2, 3]])}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getPatternSelector(0));
      await user.click(screen.getByRole("option", { name: "Pattern1" }));

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 100, patternId: "Pattern1" },
      ]);
    });

    it("sets patternId to undefined when constant is selected", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: "Pattern1" }]}
          patterns={aPatterns(["Pattern1", [1, 2, 3]])}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getPatternSelector(0));
      await user.click(screen.getByRole("option", { name: /constant/i }));

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 100, patternId: undefined },
      ]);
    });
  });

  describe("adding rows", () => {
    it("adds a new row with default values when add button is clicked", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getAddRowButton());

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 100, patternId: undefined },
        { baseDemand: 0, patternId: undefined },
      ]);
    });
  });

  describe("row actions", () => {
    it("deletes a row when delete action is selected", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[
            { baseDemand: 100, patternId: undefined },
            { baseDemand: 200, patternId: undefined },
          ]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getActionsButton(0));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 200, patternId: undefined },
      ]);
    });

    it("inserts a row above when insert row above action is selected", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getActionsButton(0));
      await user.click(
        screen.getByRole("menuitem", { name: /insert row above/i }),
      );

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 0, patternId: undefined },
        { baseDemand: 100, patternId: undefined },
      ]);
    });

    it("inserts a row below when insert row below action is selected", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getActionsButton(0));
      await user.click(
        screen.getByRole("menuitem", { name: /insert row below/i }),
      );

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 100, patternId: undefined },
        { baseDemand: 0, patternId: undefined },
      ]);
    });

    it("disables delete when there is only one row with default values", async () => {
      const user = userEvent.setup();

      render(
        <DemandCategoriesEditor
          demands={[]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
        />,
      );

      await user.click(getActionsButton(0));
      const deleteItem = screen.getByRole("menuitem", { name: /delete/i });

      expect(deleteItem).toHaveAttribute("data-disabled");
    });

    it("enables delete when there is only one row with non-default values", async () => {
      const user = userEvent.setup();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
        />,
      );

      await user.click(getActionsButton(0));
      const deleteItem = screen.getByRole("menuitem", { name: /delete/i });

      expect(deleteItem).not.toHaveAttribute("data-disabled");
    });

    it("enables delete when there are multiple rows even with default values", async () => {
      const user = userEvent.setup();

      render(
        <DemandCategoriesEditor
          demands={[
            { baseDemand: 0, patternId: undefined },
            { baseDemand: 0, patternId: undefined },
          ]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
        />,
      );

      await user.click(getActionsButton(0));
      const deleteItem = screen.getByRole("menuitem", { name: /delete/i });

      expect(deleteItem).not.toHaveAttribute("data-disabled");
    });
  });

  describe("filtering zero demands", () => {
    it("filters out zero demand when there is only one row", async () => {
      // Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: undefined }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      const input = getBaseDemandInput(0);
      await user.click(input);
      await user.clear(input);
      await user.type(input, "0");
      await user.keyboard("{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([]);
    });

    it("keeps zero demand when there are multiple rows", async () => {
      // Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[
            { baseDemand: 100, patternId: undefined },
            { baseDemand: 50, patternId: undefined },
          ]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      const input = getBaseDemandInput(0);
      await user.click(input);
      await user.clear(input);
      await user.type(input, "0");
      await user.keyboard("{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 0, patternId: undefined },
        { baseDemand: 50, patternId: undefined },
      ]);
    });
  });
});
