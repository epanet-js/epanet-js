import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { PatternSidebar } from "./pattern-sidebar";
import { DemandPatterns } from "src/hydraulic-model/demands";

const setupUser = () => userEvent.setup();

const createMockOnAddPattern = () => {
  let nextId = 1;
  return vi.fn(() => nextId++);
};

const createPatterns = (
  entries: Array<{ id: number; label: string; multipliers: number[] }>,
): DemandPatterns => {
  return new Map(entries.map((e) => [e.id, e]));
};

describe("PatternSidebar", () => {
  describe("rendering patterns", () => {
    it("renders pattern labels as buttons", () => {
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0, 0.8] },
        { id: 2, label: "PATTERN2", multipliers: [1.0, 1.2] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "PATTERN1" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "PATTERN2" }),
      ).toBeInTheDocument();
    });

    it("shows add pattern button", () => {
      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: /add pattern/i }),
      ).toBeInTheDocument();
    });
  });

  describe("selecting patterns", () => {
    it("calls onSelectPattern with pattern ID when a pattern is clicked", async () => {
      const user = setupUser();
      const onSelectPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={null}
          onSelectPattern={onSelectPattern}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "PATTERN1" }));

      expect(onSelectPattern).toHaveBeenCalledWith(1);
    });
  });

  describe("creating new patterns", () => {
    it("shows input field when clicking add pattern", async () => {
      const user = setupUser();

      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("focuses input field when clicking add pattern", async () => {
      const user = setupUser();

      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));

      const input = screen.getByRole("textbox");
      expect(input).toHaveFocus();
    });

    it("calls onAddPattern with name and default pattern", async () => {
      const user = setupUser();
      const onAddPattern = createMockOnAddPattern();

      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));
      const input = screen.getByRole("textbox");
      await user.type(input, "  NewPattern ");
      await user.keyboard("{Enter}");

      expect(onAddPattern).toHaveBeenCalledWith("NewPattern", [1], "new");
    });

    it("hides input after successful pattern creation", async () => {
      const user = setupUser();

      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={createMockOnAddPattern()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));
      const input = screen.getByRole("textbox");
      await user.type(input, "NEWPATTERN");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
    });

    it("does not add pattern with empty name", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();

      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));
      const input = screen.getByRole("textbox");
      await user.keyboard("{Enter}");

      expect(onAddPattern).not.toHaveBeenCalled();
      // Input should still be visible
      expect(input).toBeInTheDocument();
    });

    it("does not add pattern with whitespace-only name", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();

      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));
      const input = screen.getByRole("textbox");
      await user.type(input, "   ");
      await user.keyboard("{Enter}");

      expect(onAddPattern).not.toHaveBeenCalled();
    });

    it("does not add pattern with duplicated name", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "EXISTING", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));
      const input = screen.getByRole("textbox");
      await user.type(input, "existing");
      await user.keyboard("{Enter}");

      expect(onAddPattern).not.toHaveBeenCalled();
    });

    it("cancels creation when pressing Escape", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();

      render(
        <PatternSidebar
          patterns={new Map()}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();

      // Focus the input and press Escape
      await user.click(input);
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
      expect(onAddPattern).not.toHaveBeenCalled();
    });

    it("allows saving after editing a duplicate name to be unique", async () => {
      const user = setupUser();
      const onAddPattern = createMockOnAddPattern();
      const patterns = createPatterns([
        { id: 1, label: "EXISTING", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={null}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /add pattern/i }));
      const input = screen.getByRole("textbox");

      // Type a duplicate name and try to save
      await user.type(input, "existing");
      await user.keyboard("{Enter}");

      // Should not have been called due to duplicate
      expect(onAddPattern).not.toHaveBeenCalled();

      // Now add a character to make it unique and save
      await user.type(input, "2");
      await user.keyboard("{Enter}");

      // Should now succeed with the modified name
      expect(onAddPattern).toHaveBeenCalledWith("existing2", [1], "new");
    });
  });

  describe("renaming patterns", () => {
    it("shows editable field with current label when clicking rename", async () => {
      const user = setupUser();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /rename/i }));

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("PATTERN1");
    });

    it("calls onChange with new label on successful rename", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={onChange}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /rename/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "NEWNAME");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith(1, { label: "NEWNAME" });
    });

    it("trims whitespace from renamed pattern", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={onChange}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /rename/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "  TRIMMED  ");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith(1, { label: "TRIMMED" });
    });

    it("does not rename with empty name", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={onChange}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /rename/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.keyboard("{Enter}");

      expect(onChange).not.toHaveBeenCalled();
      expect(input).toBeInTheDocument();
    });

    it("does not rename with duplicate name", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
        { id: 2, label: "PATTERN2", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={onChange}
          onDeletePattern={vi.fn()}
        />,
      );

      const actionsButtons = screen.getAllByRole("button", {
        name: /actions/i,
      });
      await user.click(actionsButtons[0]);
      await user.click(screen.getByRole("menuitem", { name: /rename/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "PATTERN2");
      await user.keyboard("{Enter}");

      expect(onChange).not.toHaveBeenCalled();
      expect(input).toBeInTheDocument();
    });

    it("cancels rename when pressing Escape", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={onChange}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /rename/i }));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "PATTERN1" }),
      ).toBeInTheDocument();
    });
  });

  describe("duplicating patterns", () => {
    it("shows input with source label when clicking duplicate", async () => {
      const user = setupUser();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0, 0.8] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("PATTERN1");
    });

    it("calls onAddPattern with source multipliers on successful duplicate", async () => {
      const user = setupUser();
      const onAddPattern = createMockOnAddPattern();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0, 0.8, 1.2] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "CLONED");
      await user.keyboard("{Enter}");

      expect(onAddPattern).toHaveBeenCalledWith(
        "CLONED",
        [1.0, 0.8, 1.2],
        "clone",
      );
    });

    it("does not duplicate with empty name", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.keyboard("{Enter}");

      expect(onAddPattern).not.toHaveBeenCalled();
      expect(input).toBeInTheDocument();
    });

    it("does not duplicate when pressing Enter without changing the pre-filled source label", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("PATTERN1");

      // Press Enter without modifying the pre-filled label
      await user.keyboard("{Enter}");

      // Should reject because PATTERN1 already exists
      expect(onAddPattern).not.toHaveBeenCalled();
      expect(input).toBeInTheDocument();
    });

    it("does not duplicate with duplicate name", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
        { id: 2, label: "EXISTING", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      const actionsButtons = screen.getAllByRole("button", {
        name: /actions/i,
      });
      await user.click(actionsButtons[0]);
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "existing");
      await user.keyboard("{Enter}");

      expect(onAddPattern).not.toHaveBeenCalled();
      expect(input).toBeInTheDocument();
    });

    it("cancels duplicate when pressing Escape", async () => {
      const user = setupUser();
      const onAddPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={1}
          onSelectPattern={vi.fn()}
          onAddPattern={onAddPattern}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
      expect(onAddPattern).not.toHaveBeenCalled();
    });

    it("selects the source pattern when starting duplicate", async () => {
      const user = setupUser();
      const onSelectPattern = vi.fn();
      const patterns = createPatterns([
        { id: 1, label: "PATTERN1", multipliers: [1.0] },
        { id: 2, label: "PATTERN2", multipliers: [1.0] },
      ]);

      render(
        <PatternSidebar
          patterns={patterns}
          selectedPatternId={null}
          onSelectPattern={onSelectPattern}
          onAddPattern={vi.fn()}
          onChangePattern={vi.fn()}
          onDeletePattern={vi.fn()}
        />,
      );

      const actionsButtons = screen.getAllByRole("button", {
        name: /actions/i,
      });
      await user.click(actionsButtons[1]);
      await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      expect(onSelectPattern).toHaveBeenCalledWith(2);
    });
  });
});
