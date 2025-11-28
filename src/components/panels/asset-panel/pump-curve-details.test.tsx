import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PumpCurveTable } from "./pump-curve-details";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { ICurve } from "src/hydraulic-model/curves";

const quantities = new Quantities(presets.LPS);

const aCurve = (points: { x: number; y: number }[]): ICurve => ({
  id: "curve1",
  type: "pump",
  points,
});

const getFlowInput = (rowLabel: string) =>
  screen.getByRole("textbox", { name: new RegExp(`${rowLabel}-x`, "i") });

const getHeadInput = (rowLabel: string) =>
  screen.getByRole("textbox", { name: new RegExp(`${rowLabel}-y`, "i") });

describe("PumpCurveTable", () => {
  describe("initialization", () => {
    it("shows 3 rows with shutoff flow=0 when no curve provided", () => {
      render(
        <PumpCurveTable
          definitionType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowInput("Shutoff")).toHaveValue("0");
      expect(getHeadInput("Shutoff")).toHaveValue("");
      expect(getFlowInput("Design")).toHaveValue("");
      expect(getHeadInput("Design")).toHaveValue("");
      expect(getFlowInput("Max Operating")).toHaveValue("");
      expect(getHeadInput("Max Operating")).toHaveValue("");
    });

    it("displays all 3 points from standard curve", () => {
      const curve = aCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowInput("Shutoff")).toHaveValue("0");
      expect(getHeadInput("Shutoff")).toHaveValue("100");
      expect(getFlowInput("Design")).toHaveValue("50");
      expect(getHeadInput("Design")).toHaveValue("80");
      expect(getFlowInput("Max Operating")).toHaveValue("100");
      expect(getHeadInput("Max Operating")).toHaveValue("0");
    });

    it("derives shutoff and max operating from design point in design-point mode", () => {
      const curve = aCurve([{ x: 50, y: 100 }]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowInput("Shutoff")).toHaveValue("0");
      expect(getHeadInput("Shutoff")).toHaveValue("133");
      expect(getFlowInput("Design")).toHaveValue("50");
      expect(getHeadInput("Design")).toHaveValue("100");
      expect(getFlowInput("Max Operating")).toHaveValue("100");
      expect(getHeadInput("Max Operating")).toHaveValue("0");
    });

    it("takes middle point from multi-point curve in design-point mode", () => {
      const curve = aCurve([
        { x: 0, y: 133 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowInput("Design")).toHaveValue("50");
      expect(getHeadInput("Design")).toHaveValue("100");
    });
  });

  describe("design-point mode", () => {
    it("only allows editing design point row", () => {
      const curve = aCurve([{ x: 50, y: 100 }]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowInput("Shutoff")).toHaveAttribute("readonly");
      expect(getHeadInput("Shutoff")).toHaveAttribute("readonly");
      expect(getFlowInput("Max Operating")).toHaveAttribute("readonly");
      expect(getHeadInput("Max Operating")).toHaveAttribute("readonly");

      expect(getFlowInput("Design")).not.toHaveAttribute("readonly");
      expect(getHeadInput("Design")).not.toHaveAttribute("readonly");
    });

    it("updates derived values when design point changes", async () => {
      const user = userEvent.setup();
      const curve = aCurve([{ x: 50, y: 100 }]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      const headInput = getHeadInput("Design");
      await user.click(headInput);
      await user.clear(headInput);
      await user.type(headInput, "200");
      await user.keyboard("{Enter}");

      expect(getHeadInput("Shutoff")).toHaveValue("266");
    });

    it("shows warning styling when design point is incomplete", () => {
      render(
        <PumpCurveTable
          definitionType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowInput("Design")).toHaveClass("border-orange-500");
      expect(getHeadInput("Design")).toHaveClass("border-orange-500");
    });

    it("calls onCurveChange with single point when valid", async () => {
      const user = userEvent.setup();
      const onCurveChange = vi.fn();

      render(
        <PumpCurveTable
          definitionType="design-point"
          quantities={quantities}
          onCurveChange={onCurveChange}
        />,
      );

      const flowInput = getFlowInput("Design");
      await user.click(flowInput);
      await user.type(flowInput, "50");
      await user.keyboard("{Enter}");

      const headInput = getHeadInput("Design");
      await user.click(headInput);
      await user.type(headInput, "100");
      await user.keyboard("{Enter}");

      expect(onCurveChange).toHaveBeenCalledWith([{ flow: 50, head: 100 }]);
    });
  });

  describe("standard mode", () => {
    it("shutoff flow is always 0 and read-only", () => {
      const curve = aCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowInput("Shutoff")).toHaveAttribute("readonly");
      expect(getFlowInput("Shutoff")).toHaveValue("0");
    });

    it("allows editing all head values and design/maxOp flows", () => {
      const curve = aCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getHeadInput("Shutoff")).not.toHaveAttribute("readonly");
      expect(getHeadInput("Design")).not.toHaveAttribute("readonly");
      expect(getHeadInput("Max Operating")).not.toHaveAttribute("readonly");

      expect(getFlowInput("Design")).not.toHaveAttribute("readonly");
      expect(getFlowInput("Max Operating")).not.toHaveAttribute("readonly");
    });

    it("shows warning styling when points are missing", () => {
      render(
        <PumpCurveTable
          definitionType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getHeadInput("Shutoff")).toHaveClass("border-orange-500");
      expect(getFlowInput("Design")).toHaveClass("border-orange-500");
      expect(getHeadInput("Design")).toHaveClass("border-orange-500");
      expect(getFlowInput("Max Operating")).toHaveClass("border-orange-500");
      expect(getHeadInput("Max Operating")).toHaveClass("border-orange-500");
    });

    it("shows validation error when flows are not in ascending order", async () => {
      const user = userEvent.setup();
      const curve = aCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 10 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      const maxFlowInput = getFlowInput("Max Operating");
      await user.click(maxFlowInput);
      await user.clear(maxFlowInput);
      await user.type(maxFlowInput, "30");
      await user.keyboard("{Enter}");

      expect(screen.getByText(/ascending order/i)).toBeInTheDocument();
    });

    it("calls onCurveChange with 3 points when valid", async () => {
      const user = userEvent.setup();
      const onCurveChange = vi.fn();
      const curve = aCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 10 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="standard"
          quantities={quantities}
          onCurveChange={onCurveChange}
        />,
      );

      const headInput = getHeadInput("Design");
      await user.click(headInput);
      await user.clear(headInput);
      await user.type(headInput, "90");
      await user.keyboard("{Enter}");

      expect(onCurveChange).toHaveBeenCalledWith([
        { flow: 0, head: 100 },
        { flow: 50, head: 90 },
        { flow: 100, head: 10 },
      ]);
    });
  });

  describe("clearing values", () => {
    it("clearing a field sets it to undefined and shows warning styling", async () => {
      const user = userEvent.setup();
      const curve = aCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 10 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      const headInput = getHeadInput("Design");
      await user.click(headInput);
      await user.clear(headInput);
      await user.keyboard("{Enter}");

      expect(headInput).toHaveValue("");
      expect(headInput).toHaveClass("border-orange-500");
    });

    it("clearing design point in design-point mode clears derived values", async () => {
      const user = userEvent.setup();
      const curve = aCurve([{ x: 50, y: 100 }]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      const headInput = getHeadInput("Design");
      await user.click(headInput);
      await user.clear(headInput);
      await user.keyboard("{Enter}");

      expect(getHeadInput("Shutoff")).toHaveValue("");
    });
  });

  describe("read-only mode", () => {
    it("all fields are read-only when onCurveChange is undefined", () => {
      const curve = aCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ]);

      render(
        <PumpCurveTable
          curve={curve}
          definitionType="standard"
          quantities={quantities}
        />,
      );

      expect(getFlowInput("Shutoff")).toHaveAttribute("readonly");
      expect(getHeadInput("Shutoff")).toHaveAttribute("readonly");
      expect(getFlowInput("Design")).toHaveAttribute("readonly");
      expect(getHeadInput("Design")).toHaveAttribute("readonly");
      expect(getFlowInput("Max Operating")).toHaveAttribute("readonly");
      expect(getHeadInput("Max Operating")).toHaveAttribute("readonly");
    });

    it("does not show warning styling in read-only mode when curve is invalid", () => {
      render(
        <PumpCurveTable definitionType="standard" quantities={quantities} />,
      );

      expect(getHeadInput("Shutoff")).not.toHaveClass("border-orange-500");
      expect(getFlowInput("Design")).not.toHaveClass("border-orange-500");
      expect(getHeadInput("Design")).not.toHaveClass("border-orange-500");
    });
  });
});
