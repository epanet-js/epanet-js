import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemandCategoriesEditor } from "./demand-categories-editor";
import {
  DemandPattern,
  DemandPatterns,
  JunctionDemand,
  PatternId,
  PatternMultipliers,
} from "src/hydraulic-model/demands";

const aPatterns = (
  ...patterns: [PatternId, string, PatternMultipliers][]
): Map<PatternId, DemandPattern> => {
  const demandPatterns: DemandPatterns = new Map();
  (patterns || []).forEach(([id, label, multipliers]) => {
    demandPatterns.set(id, { id, label, multipliers });
  });
  return demandPatterns;
};

const getBaseDemandInput = (rowIndex: number) => {
  // Each row has 2 textboxes: baseDemand (index 0, 2, 4...) and pattern selector (index 1, 3, 5...)
  const inputs = screen.getAllByRole("textbox");
  return inputs[rowIndex * 2];
};

const getPatternSelector = (rowIndex: number) => {
  // Each row has 2 textboxes: baseDemand (index 0, 2, 4...) and pattern selector (index 1, 3, 5...)
  const inputs = screen.getAllByRole("textbox");
  return inputs[rowIndex * 2 + 1];
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
      expect(getPatternSelector(0)).toHaveValue("CONSTANT");
    });

    it("displays existing demands", () => {
      const PATTERN_ID = 1;
      const demands: JunctionDemand[] = [
        { baseDemand: 100, patternId: PATTERN_ID },
        { baseDemand: 50 },
      ];

      render(
        <DemandCategoriesEditor
          demands={demands}
          patterns={aPatterns([PATTERN_ID, "Pattern1", [1, 2, 3]])}
          onDemandsChange={vi.fn()}
        />,
      );

      expect(getBaseDemandInput(0)).toHaveValue("100");
      expect(getPatternSelector(0)).toHaveValue("Pattern1");
      expect(getBaseDemandInput(1)).toHaveValue("50");
      expect(getPatternSelector(1)).toHaveValue("CONSTANT");
    });

    it("shows all available patterns in the dropdown", async () => {
      // Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const IDS = { PAT1: 1, PAT2: 2 };

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns(
            [IDS.PAT1, "Pattern1", [1]],
            [IDS.PAT2, "Pattern2", [2]],
          )}
          onDemandsChange={vi.fn()}
        />,
      );

      // Click the input to focus it and trigger dropdown open
      const patternInput = getPatternSelector(0);
      await user.click(patternInput);
      // Focus the input directly to simulate cell activation
      patternInput.focus();

      // Wait for dropdown to open and options to appear
      expect(
        await screen.findByRole("option", { name: /constant/i }),
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
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      const input = getBaseDemandInput(0);
      await user.click(input);
      await user.clear(input);
      await user.type(input, "200");
      await user.keyboard("{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([{ baseDemand: 200 }]);
    });
  });

  describe("editing pattern", () => {
    it("calls onDemandsChange when pattern is changed", async () => {
      const PATTERN_ID = 1;
      // Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns([PATTERN_ID, "Pattern1", [1, 2, 3]])}
          onDemandsChange={onDemandsChange}
        />,
      );

      // Click and focus to activate cell and open dropdown
      const patternInput = getPatternSelector(0);
      await user.click(patternInput);
      patternInput.focus();
      // Wait for dropdown to open
      const pattern1Option = await screen.findByRole("option", {
        name: "Pattern1",
      });
      await user.click(pattern1Option);

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 100, patternId: PATTERN_ID },
      ]);
    });

    it("sets patternId to undefined when constant is selected", async () => {
      const PATTERN_ID = 1;
      // Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: 1 }]}
          patterns={aPatterns([PATTERN_ID, "Pattern1", [1, 2, 3]])}
          onDemandsChange={onDemandsChange}
        />,
      );

      // Click and focus to activate cell and open dropdown
      const patternInput = getPatternSelector(0);
      await user.click(patternInput);
      patternInput.focus();
      // Wait for dropdown to open
      const constantOption = await screen.findByRole("option", {
        name: /constant/i,
      });
      await user.click(constantOption);

      expect(onDemandsChange).toHaveBeenCalledWith([{ baseDemand: 100 }]);
    });
  });

  describe("adding rows", () => {
    it("adds a new row with default values when add button is clicked", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getAddRowButton());

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 100 },
        { baseDemand: 0 },
      ]);
    });
  });

  describe("row actions", () => {
    it("deletes a row when delete action is selected", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }, { baseDemand: 200 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getActionsButton(0));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      expect(onDemandsChange).toHaveBeenCalledWith([{ baseDemand: 200 }]);
    });

    it("inserts a row above when insert row above action is selected", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getActionsButton(0));
      await user.click(
        screen.getByRole("menuitem", { name: /insert row above/i }),
      );

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 0 },
        { baseDemand: 100 },
      ]);
    });

    it("inserts a row below when insert row below action is selected", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
        />,
      );

      await user.click(getActionsButton(0));
      await user.click(
        screen.getByRole("menuitem", { name: /insert row below/i }),
      );

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 100 },
        { baseDemand: 0 },
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
          demands={[{ baseDemand: 100 }]}
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
          demands={[{ baseDemand: 0 }, { baseDemand: 0 }]}
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
          demands={[{ baseDemand: 100 }]}
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
          demands={[{ baseDemand: 100 }, { baseDemand: 50 }]}
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
        { baseDemand: 0 },
        { baseDemand: 50 },
      ]);
    });
  });
});
