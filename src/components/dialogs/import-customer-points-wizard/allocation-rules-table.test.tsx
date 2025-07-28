import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllocationRulesTable } from "./allocation-rules-table";
import { AllocationRule } from "./types";
import { vi } from "vitest";

type AllocationRulesTableProps = {
  rules: AllocationRule[];
  allocationCounts: number[];
  isEditing: boolean;
  onChange: (newRules: AllocationRule[]) => void;
};

describe("AllocationRulesTable", () => {
  describe("Display States", () => {
    it("shows empty state when no rules are provided", () => {
      renderComponent();

      expect(
        screen.getByText(/No allocation rules defined/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Click "Add Rule" to create your first rule/i),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows read-only table when isEditing is false", () => {
      const rules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 150, maxDiameter: 300 },
      ];
      const allocationCounts = [25, 40];

      renderComponent({
        rules,
        allocationCounts,
      });

      expect(screen.getByText("Order")).toBeInTheDocument();
      expect(screen.getByText("Max Diameter (mm)")).toBeInTheDocument();
      expect(screen.getByText("Max Distance (m)")).toBeInTheDocument();
      expect(screen.getByText("Allocations")).toBeInTheDocument();
      expect(screen.queryByText("Actions")).not.toBeInTheDocument();

      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("40")).toBeInTheDocument();

      expect(
        screen.queryByRole("button", { name: /Add Rule/i }),
      ).not.toBeInTheDocument();

      const diameterFields = screen.getAllByLabelText(
        "Value for: Max Diameter",
      );
      const distanceFields = screen.getAllByLabelText(
        "Value for: Max Distance",
      );
      expect(diameterFields[0]).toHaveAttribute("readOnly");
      expect(distanceFields[0]).toHaveAttribute("readOnly");
    });

    it("shows editable table when isEditing is true", () => {
      const rules: AllocationRule[] = [{ maxDistance: 100, maxDiameter: 200 }];
      const allocationCounts = [25];

      renderComponent({
        rules,
        allocationCounts,
        isEditing: true,
      });

      expect(screen.getByText("Order")).toBeInTheDocument();
      expect(screen.getByText("Max Diameter (mm)")).toBeInTheDocument();
      expect(screen.getByText("Max Distance (m)")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
      expect(screen.queryByText("Allocations")).not.toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: /Add Rule/i }),
      ).toBeInTheDocument();
      expect(screen.getByTitle("Move up")).toBeInTheDocument();
      expect(screen.getByTitle("Move down")).toBeInTheDocument();
      expect(screen.getByTitle("Remove rule")).toBeInTheDocument();

      const diameterField = screen.getByLabelText("Value for: Max Diameter");
      const distanceField = screen.getByLabelText("Value for: Max Distance");
      expect(diameterField).not.toHaveAttribute("readOnly");
      expect(distanceField).not.toHaveAttribute("readOnly");
    });
  });

  describe("Rule Operations", () => {
    it("calls onChange with new rule when Add Rule is clicked", async () => {
      const user = userEvent.setup();
      const rules: AllocationRule[] = [{ maxDistance: 100, maxDiameter: 200 }];
      const onChange = vi.fn();

      renderComponent({
        rules,
        allocationCounts: [25],
        isEditing: true,
        onChange,
      });

      const addButton = screen.getByRole("button", { name: /Add Rule/i });
      await user.click(addButton);

      expect(onChange).toHaveBeenCalledWith([
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 100, maxDiameter: 200 },
      ]);
    });

    it("calls onChange with removed rule when delete is clicked", async () => {
      const user = userEvent.setup();
      const rules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 150, maxDiameter: 300 },
      ];
      const onChange = vi.fn();

      renderComponent({
        rules,
        allocationCounts: [25, 40],
        isEditing: true,
        onChange,
      });

      const deleteButtons = screen.getAllByTitle("Remove rule");
      await user.click(deleteButtons[0]);

      expect(onChange).toHaveBeenCalledWith([
        { maxDistance: 150, maxDiameter: 300 },
      ]);
    });

    it("calls onChange with reordered rules when move up is clicked", async () => {
      const user = userEvent.setup();
      const rules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 150, maxDiameter: 300 },
      ];
      const onChange = vi.fn();

      renderComponent({
        rules,
        allocationCounts: [25, 40],
        isEditing: true,
        onChange,
      });

      const moveUpButtons = screen.getAllByTitle("Move up");
      await user.click(moveUpButtons[1]);

      expect(onChange).toHaveBeenCalledWith([
        { maxDistance: 150, maxDiameter: 300 },
        { maxDistance: 100, maxDiameter: 200 },
      ]);
    });

    it("calls onChange with reordered rules when move down is clicked", async () => {
      const user = userEvent.setup();
      const rules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 150, maxDiameter: 300 },
      ];
      const onChange = vi.fn();

      renderComponent({
        rules,
        allocationCounts: [25, 40],
        isEditing: true,
        onChange,
      });

      const moveDownButtons = screen.getAllByTitle("Move down");
      await user.click(moveDownButtons[0]);

      expect(onChange).toHaveBeenCalledWith([
        { maxDistance: 150, maxDiameter: 300 },
        { maxDistance: 100, maxDiameter: 200 },
      ]);
    });
  });

  describe("Field Editing", () => {
    it("calls onChange when diameter field changes", () => {
      const rules: AllocationRule[] = [{ maxDistance: 100, maxDiameter: 200 }];
      const onChange = vi.fn();

      renderComponent({
        rules,
        allocationCounts: [25],
        isEditing: true,
        onChange,
      });

      const diameterField = screen.getByLabelText("Value for: Max Diameter");

      fireEvent.focus(diameterField);
      fireEvent.change(diameterField, { target: { value: "250" } });
      fireEvent.blur(diameterField);

      expect(onChange).toHaveBeenCalledWith([
        { maxDistance: 100, maxDiameter: 250 },
      ]);
    });

    it("calls onChange when distance field changes", () => {
      const rules: AllocationRule[] = [{ maxDistance: 100, maxDiameter: 200 }];
      const onChange = vi.fn();

      renderComponent({
        rules,
        allocationCounts: [25],
        isEditing: true,
        onChange,
      });

      const distanceField = screen.getByLabelText("Value for: Max Distance");

      fireEvent.focus(distanceField);
      fireEvent.change(distanceField, { target: { value: "125" } });
      fireEvent.blur(distanceField);

      expect(onChange).toHaveBeenCalledWith([
        { maxDistance: 125, maxDiameter: 200 },
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("disables move up button for first rule", () => {
      const rules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 150, maxDiameter: 300 },
      ];

      renderComponent({
        rules,
        allocationCounts: [25, 40],
        isEditing: true,
      });

      const moveUpButtons = screen.getAllByTitle("Move up");
      expect(moveUpButtons[0]).toBeDisabled();
      expect(moveUpButtons[1]).not.toBeDisabled();
    });

    it("disables move down button for last rule", () => {
      const rules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 150, maxDiameter: 300 },
      ];

      renderComponent({
        rules,
        allocationCounts: [25, 40],
        isEditing: true,
      });

      const moveDownButtons = screen.getAllByTitle("Move down");
      expect(moveDownButtons[0]).not.toBeDisabled();
      expect(moveDownButtons[1]).toBeDisabled();
    });

    it("handles single rule scenario correctly", () => {
      const rules: AllocationRule[] = [{ maxDistance: 100, maxDiameter: 200 }];

      renderComponent({
        rules,
        allocationCounts: [25],
        isEditing: true,
      });

      const moveUpButton = screen.getByTitle("Move up");
      const moveDownButton = screen.getByTitle("Move down");

      expect(moveUpButton).toBeDisabled();
      expect(moveDownButton).toBeDisabled();
    });

    it("displays correct order numbers", () => {
      const rules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 150, maxDiameter: 300 },
        { maxDistance: 200, maxDiameter: 400 },
      ];

      renderComponent({
        rules,
        allocationCounts: [25, 40, 35],
      });

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("handles multiple operations in sequence", async () => {
      const user = userEvent.setup();
      let currentRules: AllocationRule[] = [
        { maxDistance: 100, maxDiameter: 200 },
      ];

      const mockOnChangeIntegration = vi.fn((newRules: AllocationRule[]) => {
        currentRules = newRules;
      });

      const { rerender } = render(
        <AllocationRulesTable
          rules={currentRules}
          allocationCounts={[25]}
          isEditing={true}
          onChange={mockOnChangeIntegration}
        />,
      );

      await user.click(screen.getByRole("button", { name: /Add Rule/i }));
      expect(mockOnChangeIntegration).toHaveBeenLastCalledWith([
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 100, maxDiameter: 200 },
      ]);

      currentRules = [
        { maxDistance: 100, maxDiameter: 200 },
        { maxDistance: 100, maxDiameter: 200 },
      ];
      rerender(
        <AllocationRulesTable
          rules={currentRules}
          allocationCounts={[25, 30]}
          isEditing={true}
          onChange={mockOnChangeIntegration}
        />,
      );

      const deleteButtons = screen.getAllByTitle("Remove rule");
      await user.click(deleteButtons[0]);
      expect(mockOnChangeIntegration).toHaveBeenLastCalledWith([
        { maxDistance: 100, maxDiameter: 200 },
      ]);
    });
  });

  const renderComponent = ({
    rules = [],
    allocationCounts = [],
    isEditing = false,
    onChange = vi.fn(),
  }: Partial<AllocationRulesTableProps> = {}) => {
    render(
      <AllocationRulesTable
        rules={rules}
        allocationCounts={allocationCounts}
        isEditing={isEditing}
        onChange={onChange}
      />,
    );
  };
});
