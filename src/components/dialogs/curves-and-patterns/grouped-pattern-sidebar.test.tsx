import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { GroupedPatternSidebar } from "./grouped-pattern-sidebar";
import { Patterns, PatternType } from "src/hydraulic-model";

const setupUser = () => userEvent.setup();

const createMockOnAddPattern = () => {
  let nextId = 100;
  return vi.fn(() => nextId++);
};

const createPatterns = (
  entries: Array<{
    id: number;
    label: string;
    multipliers: number[];
    type?: PatternType;
  }>,
): Patterns => {
  return new Map(entries.map((e) => [e.id, e]));
};

const defaultProps = {
  selectedPatternId: null,
  minPatternSteps: 1,
  onSelectPattern: vi.fn(),
  onAddPattern: vi.fn(),
  onChangePattern: vi.fn(),
  onDeletePattern: vi.fn(),
};

const getSectionHeader = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("GroupedPatternSidebar", () => {
  describe("rendering sections", () => {
    it("renders three section headings", () => {
      render(<GroupedPatternSidebar {...defaultProps} patterns={new Map()} />);

      expect(getSectionHeader("Demand patterns")).toBeInTheDocument();
      expect(getSectionHeader("Reservoir head patterns")).toBeInTheDocument();
      expect(getSectionHeader("Pump speed patterns")).toBeInTheDocument();
    });

    it("groups patterns by type into correct sections", () => {
      const patterns = createPatterns([
        { id: 1, label: "DemandP", multipliers: [1.0], type: "demand" },
        {
          id: 2,
          label: "ReservoirP",
          multipliers: [1.0],
          type: "reservoirHead",
        },
        { id: 3, label: "PumpP", multipliers: [1.0], type: "pumpSpeed" },
      ]);

      render(<GroupedPatternSidebar {...defaultProps} patterns={patterns} />);

      expect(
        screen.getByRole("button", { name: "DemandP" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "ReservoirP" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "PumpP" })).toBeInTheDocument();
    });

    it("places untyped patterns in the demand section", () => {
      const patterns = createPatterns([
        { id: 1, label: "UntypedP", multipliers: [1.0] },
      ]);

      render(<GroupedPatternSidebar {...defaultProps} patterns={patterns} />);

      expect(
        screen.getByRole("button", { name: "UntypedP" }),
      ).toBeInTheDocument();
    });

    it("renders empty sections with just headers", () => {
      render(<GroupedPatternSidebar {...defaultProps} patterns={new Map()} />);

      expect(getSectionHeader("Demand patterns")).toBeInTheDocument();
      expect(getSectionHeader("Reservoir head patterns")).toBeInTheDocument();
      expect(getSectionHeader("Pump speed patterns")).toBeInTheDocument();
    });
  });

  describe("collapsing sections", () => {
    it("hides patterns when section is collapsed", async () => {
      const user = setupUser();
      const patterns = createPatterns([
        { id: 1, label: "DemandP", multipliers: [1.0], type: "demand" },
      ]);

      render(<GroupedPatternSidebar {...defaultProps} patterns={patterns} />);

      expect(
        screen.getByRole("button", { name: "DemandP" }),
      ).toBeInTheDocument();

      await user.click(getSectionHeader("Demand patterns"));

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "DemandP" }),
        ).not.toBeInTheDocument();
      });
    });

    it("shows patterns again when section is expanded", async () => {
      const user = setupUser();
      const patterns = createPatterns([
        { id: 1, label: "DemandP", multipliers: [1.0], type: "demand" },
      ]);

      render(<GroupedPatternSidebar {...defaultProps} patterns={patterns} />);

      // Collapse
      await user.click(getSectionHeader("Demand patterns"));
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "DemandP" }),
        ).not.toBeInTheDocument();
      });

      // Expand
      await user.click(getSectionHeader("Demand patterns"));
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "DemandP" }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("adding patterns", () => {
    it("shows add button for each section", () => {
      render(<GroupedPatternSidebar {...defaultProps} patterns={new Map()} />);

      expect(
        screen.getByRole("button", { name: /^add demand patterns$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /^add reservoir head patterns$/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^add pump speed patterns$/i }),
      ).toBeInTheDocument();
    });

    it("hides add buttons when readOnly", () => {
      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={new Map()}
          readOnly
        />,
      );

      expect(
        screen.queryByRole("button", { name: /^add demand patterns$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: /^add reservoir head patterns$/i,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^add pump speed patterns$/i }),
      ).not.toBeInTheDocument();
    });

    it("creates demand pattern when adding from demand section", async () => {
      const user = setupUser();
      const onAddPattern = createMockOnAddPattern();

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={new Map()}
          onAddPattern={onAddPattern}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /^add demand patterns$/i }),
      );
      const input = screen.getByRole("textbox");
      await user.type(input, "NewDemand");
      await user.keyboard("{Enter}");

      expect(onAddPattern).toHaveBeenCalledWith(
        "NewDemand",
        [1],
        "new",
        "demand",
      );
    });

    it("creates reservoir pattern when adding from reservoir section", async () => {
      const user = setupUser();
      const onAddPattern = createMockOnAddPattern();

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={new Map()}
          onAddPattern={onAddPattern}
        />,
      );

      await user.click(
        screen.getByRole("button", {
          name: /^add reservoir head patterns$/i,
        }),
      );
      const input = screen.getByRole("textbox");
      await user.type(input, "NewReservoir");
      await user.keyboard("{Enter}");

      expect(onAddPattern).toHaveBeenCalledWith(
        "NewReservoir",
        [1],
        "new",
        "reservoirHead",
      );
    });

    it("creates pump pattern when adding from pump section", async () => {
      const user = setupUser();
      const onAddPattern = createMockOnAddPattern();

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={new Map()}
          onAddPattern={onAddPattern}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /^add pump speed patterns$/i }),
      );
      const input = screen.getByRole("textbox");
      await user.type(input, "NewPump");
      await user.keyboard("{Enter}");

      expect(onAddPattern).toHaveBeenCalledWith(
        "NewPump",
        [1],
        "new",
        "pumpSpeed",
      );
    });
  });

  describe("duplicating patterns", () => {
    it("preserves source pattern type when duplicating", async () => {
      const user = setupUser();
      const onAddPattern = createMockOnAddPattern();
      const patterns = createPatterns([
        {
          id: 1,
          label: "ReservoirP",
          multipliers: [1.0, 0.8],
          type: "reservoirHead",
        },
      ]);

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={patterns}
          selectedPatternId={1}
          onAddPattern={onAddPattern}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "ReservoirClone");
      await user.keyboard("{Enter}");

      expect(onAddPattern).toHaveBeenCalledWith(
        "ReservoirClone",
        [1.0, 0.8],
        "clone",
        "reservoirHead",
      );
    });
  });

  describe("label uniqueness", () => {
    it("prevents duplicate names across sections", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "SHARED_NAME", multipliers: [1.0], type: "demand" },
      ]);

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={patterns}
          onAddPattern={onAddPattern}
        />,
      );

      // Try to create a pump pattern with the same name as an existing demand pattern
      await user.click(
        screen.getByRole("button", { name: /^add pump speed patterns$/i }),
      );
      const input = screen.getByRole("textbox");
      await user.type(input, "SHARED_NAME");
      await user.keyboard("{Enter}");

      expect(onAddPattern).not.toHaveBeenCalled();
    });
  });

  describe("selecting patterns", () => {
    it("calls onSelectPattern when clicking a pattern", async () => {
      const user = setupUser();
      const onSelectPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "DemandP", multipliers: [1.0], type: "demand" },
      ]);

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={patterns}
          onSelectPattern={onSelectPattern}
        />,
      );

      await user.click(screen.getByRole("button", { name: "DemandP" }));
      expect(onSelectPattern).toHaveBeenCalledWith(1);
    });
  });

  describe("keyboard navigation", () => {
    it("navigates through section headers and patterns with arrow keys", async () => {
      const user = setupUser();
      const onSelectPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "DemandP", multipliers: [1.0], type: "demand" },
        {
          id: 2,
          label: "ReservoirP",
          multipliers: [1.0],
          type: "reservoirHead",
        },
      ]);

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={onSelectPattern}
        />,
      );

      const container = screen
        .getByRole("button", { name: "DemandP" })
        .closest("[tabindex]") as HTMLElement;
      container.focus();

      // ArrowDown from DemandP lands on the Reservoir section header, clearing selection
      await user.keyboard("{ArrowDown}");
      expect(onSelectPattern).toHaveBeenCalledWith(null);

      // ArrowDown again lands on ReservoirP
      await user.keyboard("{ArrowDown}");
      expect(onSelectPattern).toHaveBeenCalledWith(2);
    });

    it("toggles section collapse with Enter on a focused section header", async () => {
      const user = setupUser();
      const patterns = createPatterns([
        {
          id: 1,
          label: "ReservoirP",
          multipliers: [1.0],
          type: "reservoirHead",
        },
      ]);

      render(<GroupedPatternSidebar {...defaultProps} patterns={patterns} />);

      const container = screen
        .getByRole("button", { name: "ReservoirP" })
        .closest("[tabindex]") as HTMLElement;
      container.focus();

      // Navigate to Demand section header (first item)
      await user.keyboard("{Home}");

      // Navigate down to Reservoir section header (second item, demand has no patterns)
      await user.keyboard("{ArrowDown}");

      // Press Enter to collapse
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "ReservoirP" }),
        ).not.toBeInTheDocument();
      });

      // Press Enter again to expand
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "ReservoirP" }),
        ).toBeInTheDocument();
      });
    });

    it("skips collapsed section patterns during navigation", async () => {
      const user = setupUser();
      const onSelectPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "DemandP", multipliers: [1.0], type: "demand" },
        {
          id: 2,
          label: "ReservoirP",
          multipliers: [1.0],
          type: "reservoirHead",
        },
        { id: 3, label: "PumpP", multipliers: [1.0], type: "pumpSpeed" },
      ]);

      render(
        <GroupedPatternSidebar
          {...defaultProps}
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={onSelectPattern}
        />,
      );

      // Collapse reservoir section
      await user.click(getSectionHeader("Reservoir head patterns"));

      const container = screen
        .getByRole("button", { name: "DemandP" })
        .closest("[tabindex]") as HTMLElement;
      container.focus();

      // ArrowDown from DemandP -> Reservoir header -> Pump header -> PumpP
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(onSelectPattern).toHaveBeenCalledWith(3);
    });
  });
});
