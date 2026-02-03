import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemandCategoriesEditor } from "./demands-editor";
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

const getRows = () => screen.getAllByRole("row").slice(1); // Skip header row

const getCell = (rowIndex: number, colIndex: number) => {
  const rows = getRows();
  const row = rows[rowIndex];
  const cells = within(row).getAllByRole("gridcell");
  return cells[colIndex];
};

const getBaseDemandCell = (rowIndex: number) => getCell(rowIndex, 0);
const getPatternCell = (rowIndex: number) => getCell(rowIndex, 1);

const getAddRowButton = () => {
  return screen.getByRole("button", { name: /add demand category/i });
};

const getActionsButton = (rowIndex: number) => {
  const buttons = screen.getAllByRole("button", { name: /actions/i });
  return buttons[rowIndex];
};

describe("DemandCategoriesEditor", () => {
  describe("initialization", () => {
    it("shows add direct demand button when no demands provided", () => {
      render(
        <DemandCategoriesEditor
          demands={[]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
          readOnly={false}
        />,
      );

      expect(
        screen.getByRole("button", { name: /add direct demand/i }),
      ).toBeInTheDocument();
    });

    it("shows grid with default row when add direct demand button is clicked", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /add direct demand/i }),
      );

      // Grid should be shown with default row
      expect(getBaseDemandCell(0)).toHaveTextContent("0");
      expect(getPatternCell(0)).toHaveTextContent("CONSTANT");

      // onDemandsChange should not be called until actual changes are made
      expect(onDemandsChange).not.toHaveBeenCalled();
    });

    it("persists changes when baseDemand is changed from default in empty grid", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      // Click add button to show empty grid
      await user.click(
        screen.getByRole("button", { name: /add direct demand/i }),
      );

      // Edit the base demand
      const baseDemandCell = getBaseDemandCell(0);
      await user.click(baseDemandCell);
      await user.dblClick(baseDemandCell);

      const input = within(baseDemandCell).getByRole("textbox");
      await user.clear(input);
      await user.keyboard("50{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([{ baseDemand: 50 }]);
    });

    it("persists changes when pattern is changed from default in empty grid", async () => {
      const PATTERN_ID = 1;
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[]}
          patterns={aPatterns([PATTERN_ID, "Pattern1", [1, 2, 3]])}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      // Click add button to show empty grid
      await user.click(
        screen.getByRole("button", { name: /add direct demand/i }),
      );

      // Click pattern cell button - opens dropdown immediately
      const patternCell = getPatternCell(0);
      await user.click(within(patternCell).getByRole("button"));

      const pattern1Option = await screen.findByRole("option", {
        name: "Pattern1",
      });
      await user.click(pattern1Option);

      // Should persist because pattern changed (even though baseDemand is still 0)
      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 0, patternId: PATTERN_ID },
      ]);
    });

    it("renders nothing when no demands and readOnly is true", () => {
      const { container } = render(
        <DemandCategoriesEditor
          demands={[]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
          readOnly={true}
        />,
      );

      expect(container.firstChild).toBeNull();
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
          readOnly={false}
        />,
      );

      expect(getBaseDemandCell(0)).toHaveTextContent("100");
      expect(getPatternCell(0)).toHaveTextContent("Pattern1");
      expect(getBaseDemandCell(1)).toHaveTextContent("50");
      expect(getPatternCell(1)).toHaveTextContent("CONSTANT");
    });

    it("shows all available patterns in the dropdown", async () => {
      const user = userEvent.setup();
      const IDS = { PAT1: 1, PAT2: 2 };

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns(
            [IDS.PAT1, "Pattern1", [1]],
            [IDS.PAT2, "Pattern2", [2]],
          )}
          onDemandsChange={vi.fn()}
          readOnly={false}
        />,
      );

      // Click pattern cell button - opens dropdown immediately
      const patternCell = getPatternCell(0);
      await user.click(within(patternCell).getByRole("button"));

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
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      // Click cell to select, then double-click to edit
      const baseDemandCell = getBaseDemandCell(0);
      await user.click(baseDemandCell);
      await user.dblClick(baseDemandCell);

      // Find the input, triple-click to select all, then type
      const input = within(baseDemandCell).getByRole("textbox");
      await user.clear(input);
      await user.keyboard("200{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([{ baseDemand: 200 }]);
    });
  });

  describe("editing pattern", () => {
    it("calls onDemandsChange when pattern is changed", async () => {
      const PATTERN_ID = 1;
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns([PATTERN_ID, "Pattern1", [1, 2, 3]])}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      // Click pattern cell button - opens dropdown immediately
      const patternCell = getPatternCell(0);
      await user.click(within(patternCell).getByRole("button"));

      // Wait for dropdown to open and select option
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
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100, patternId: 1 }]}
          patterns={aPatterns([PATTERN_ID, "Pattern1", [1, 2, 3]])}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      // Click pattern cell button - opens dropdown immediately
      const patternCell = getPatternCell(0);
      await user.click(within(patternCell).getByRole("button"));

      // Wait for dropdown to open and select CONSTANT
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
          readOnly={false}
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
          readOnly={false}
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
          readOnly={false}
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
          readOnly={false}
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
          demands={[{ baseDemand: 0 }]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
          readOnly={false}
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
          readOnly={false}
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
          readOnly={false}
        />,
      );

      await user.click(getActionsButton(0));
      const deleteItem = screen.getByRole("menuitem", { name: /delete/i });

      expect(deleteItem).not.toHaveAttribute("data-disabled");
    });
  });

  describe("filtering zero demands", () => {
    it("filters out zero demand when there is only one row", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      // Click cell to select, then double-click to edit
      const baseDemandCell = getBaseDemandCell(0);
      await user.click(baseDemandCell);
      await user.dblClick(baseDemandCell);

      // Find the input, triple-click to select all, then type
      const input = within(baseDemandCell).getByRole("textbox");
      await user.clear(input);
      await user.keyboard("0{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([]);
    });

    it("keeps zero demand when there are multiple rows", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }, { baseDemand: 50 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
          readOnly={false}
        />,
      );

      // Click cell to select, then double-click to edit
      const baseDemandCell = getBaseDemandCell(0);
      await user.click(baseDemandCell);
      await user.dblClick(baseDemandCell);

      // Find the input, triple-click to select all, then type
      const input = within(baseDemandCell).getByRole("textbox");
      await user.clear(input);
      await user.keyboard("0{Enter}");

      expect(onDemandsChange).toHaveBeenCalledWith([
        { baseDemand: 0 },
        { baseDemand: 50 },
      ]);
    });
  });

  describe("read-only mode", () => {
    it("does not show add row button when readOnly is true", () => {
      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
          readOnly={true}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /add demand category/i }),
      ).not.toBeInTheDocument();
    });

    it("does not show row actions when readOnly is true", () => {
      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={vi.fn()}
          readOnly={true}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /actions/i }),
      ).not.toBeInTheDocument();
    });

    it("displays values but does not allow editing when readOnly is true", async () => {
      const user = userEvent.setup();
      const onDemandsChange = vi.fn();

      render(
        <DemandCategoriesEditor
          demands={[{ baseDemand: 100 }]}
          patterns={aPatterns()}
          onDemandsChange={onDemandsChange}
          readOnly={true}
        />,
      );

      // Values should be displayed
      expect(getBaseDemandCell(0)).toHaveTextContent("100");
      expect(getPatternCell(0)).toHaveTextContent("CONSTANT");

      // Click cell to select, then double-click should not enable editing
      const baseDemandCell = getBaseDemandCell(0);
      await user.click(baseDemandCell);
      await user.dblClick(baseDemandCell);

      // Should not find any input (editing mode should not activate)
      expect(
        within(getBaseDemandCell(0)).queryByRole("textbox"),
      ).not.toBeInTheDocument();

      // onDemandsChange should not be called
      expect(onDemandsChange).not.toHaveBeenCalled();
    });
  });
});
