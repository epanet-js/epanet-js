import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PumpCurveTable,
  PumpDefinitionDetails,
} from "./pump-definition-details";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { buildPump } from "src/__helpers__/hydraulic-model-builder";

const quantities = new Quantities(presets.LPS);

const getFlowInput = (rowLabel: string) =>
  screen.getByRole("textbox", { name: new RegExp(`${rowLabel}-x`, "i") });

const getHeadInput = (rowLabel: string) =>
  screen.getByRole("textbox", { name: new RegExp(`${rowLabel}-y`, "i") });

const queryFlowInput = (rowLabel: string) =>
  screen.queryByRole("textbox", { name: new RegExp(`${rowLabel}-x`, "i") });

const queryHeadInput = (rowLabel: string) =>
  screen.queryByRole("textbox", { name: new RegExp(`${rowLabel}-y`, "i") });

const getFlowSpan = (rowLabel: string) => {
  const row = screen.getByText(rowLabel).closest('[role="cell"]');
  const nextCell = row?.nextElementSibling;
  return nextCell?.querySelector("span") as HTMLElement;
};

const getHeadSpan = (rowLabel: string) => {
  const row = screen.getByText(rowLabel).closest('[role="cell"]');
  const flowCell = row?.nextElementSibling;
  const headCell = flowCell?.nextElementSibling;
  return headCell?.querySelector("span") as HTMLElement;
};

describe("PumpCurveTable", () => {
  describe("initialization", () => {
    it("shows 3 rows with shutoff flow=0 when no curve provided", () => {
      render(
        <PumpCurveTable
          curveType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowSpan("Shutoff")).toHaveTextContent("0");
      expect(getHeadInput("Shutoff")).toHaveValue("");
      expect(getFlowInput("Design")).toHaveValue("");
      expect(getHeadInput("Design")).toHaveValue("");
      expect(getFlowInput("Max Operating")).toHaveValue("");
      expect(getHeadInput("Max Operating")).toHaveValue("");
    });

    it("displays all 3 points from standard curve", () => {
      const curve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowSpan("Shutoff")).toHaveTextContent("0");
      expect(getHeadInput("Shutoff")).toHaveValue("100");
      expect(getFlowInput("Design")).toHaveValue("50");
      expect(getHeadInput("Design")).toHaveValue("80");
      expect(getFlowInput("Max Operating")).toHaveValue("100");
      expect(getHeadInput("Max Operating")).toHaveValue("0");
    });

    it("derives shutoff and max operating from design point in design-point mode", () => {
      const curve = [{ x: 50, y: 100 }];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getFlowSpan("Shutoff")).toHaveTextContent("0");
      expect(getHeadSpan("Shutoff")).toHaveTextContent("133");
      expect(getFlowInput("Design")).toHaveValue("50");
      expect(getHeadInput("Design")).toHaveValue("100");
      expect(getFlowSpan("Max Operating")).toHaveTextContent("100");
      expect(getHeadSpan("Max Operating")).toHaveTextContent("0");
    });

    it("takes middle point from multi-point curve in design-point mode", () => {
      const curve = [
        { x: 0, y: 133 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="design-point"
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
      const curve = [{ x: 50, y: 100 }];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(queryFlowInput("Shutoff")).toBeNull();
      expect(queryHeadInput("Shutoff")).toBeNull();
      expect(queryFlowInput("Max Operating")).toBeNull();
      expect(queryHeadInput("Max Operating")).toBeNull();
      expect(getFlowInput("Design")).toBeInTheDocument();
      expect(getHeadInput("Design")).toBeInTheDocument();
    });

    it("updates derived values when design point changes", async () => {
      const user = userEvent.setup();
      const curve = [{ x: 50, y: 100 }];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      const headInput = getHeadInput("Design");
      await user.click(headInput);
      await user.clear(headInput);
      await user.type(headInput, "200");
      await user.keyboard("{Enter}");

      expect(getHeadSpan("Shutoff")).toHaveTextContent("266");
    });

    it("shows warning styling when design point is incomplete", () => {
      render(
        <PumpCurveTable
          curveType="design-point"
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
          curveType="design-point"
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
      const curve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(queryFlowInput("Shutoff")).toBeNull();
      expect(getFlowSpan("Shutoff")).toHaveTextContent("0");
    });

    it("allows editing all head values and design/maxOp flows", () => {
      const curve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="standard"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      expect(getHeadInput("Shutoff")).toBeInTheDocument();
      expect(getHeadInput("Design")).toBeInTheDocument();
      expect(getHeadInput("Max Operating")).toBeInTheDocument();

      expect(getFlowInput("Design")).toBeInTheDocument();
      expect(getFlowInput("Max Operating")).toBeInTheDocument();
    });

    it("shows warning styling when points are missing", () => {
      render(
        <PumpCurveTable
          curveType="standard"
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
      const curve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 10 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="standard"
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
      const curve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 10 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="standard"
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
      const curve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 10 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="standard"
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
      const curve = [{ x: 50, y: 100 }];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="design-point"
          quantities={quantities}
          onCurveChange={vi.fn()}
        />,
      );

      const headInput = getHeadInput("Design");
      await user.click(headInput);
      await user.clear(headInput);
      await user.keyboard("{Enter}");

      expect(getHeadSpan("Shutoff")).toHaveTextContent("");
    });
  });

  describe("read-only mode", () => {
    it("all fields are rendered as spans when onCurveChange is undefined", () => {
      const curve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ];

      render(
        <PumpCurveTable
          curve={curve}
          curveType="standard"
          quantities={quantities}
        />,
      );

      expect(queryFlowInput("Shutoff")).toBeNull();
      expect(queryHeadInput("Shutoff")).toBeNull();
      expect(queryFlowInput("Design")).toBeNull();
      expect(queryHeadInput("Design")).toBeNull();
      expect(queryFlowInput("Max Operating")).toBeNull();
      expect(queryHeadInput("Max Operating")).toBeNull();
      expect(getFlowSpan("Shutoff")).toHaveTextContent("0");
      expect(getHeadSpan("Shutoff")).toHaveTextContent("100");
    });

    it("does not show warning styling in read-only mode when curve is invalid", () => {
      render(<PumpCurveTable curveType="standard" quantities={quantities} />);

      expect(getHeadSpan("Shutoff")).not.toHaveClass("border-orange-500");
      expect(getFlowSpan("Design")).not.toHaveClass("border-orange-500");
      expect(getHeadSpan("Design")).not.toHaveClass("border-orange-500");
    });
  });
});

describe("PumpDefinitionDetails", () => {
  describe("definition type changes", () => {
    describe("changing to power type", () => {
      it("emits onChange with power value when pump has power set", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "curve",
          power: 50,
          curve: [{ x: 50, y: 100 }],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(
          screen.getByRole("option", { name: /constant power/i }),
        );

        expect(onChange).toHaveBeenCalledWith({ type: "power", power: 50 });
      });

      it("emits onChange with power=0 when pump has no power set", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "curve",
          power: 0,
          curve: [{ x: 50, y: 100 }],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(
          screen.getByRole("option", { name: /constant power/i }),
        );

        expect(onChange).toHaveBeenCalledWith({ type: "power", power: 0 });
      });
    });

    describe("changing between curve types", () => {
      it("emits onChange when changing from design-point to standard", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "curve",
          curve: [{ x: 50, y: 100 }],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(
          screen.getByRole("option", { name: /standard curve/i }),
        );

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [
            { x: 0, y: 133 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
          ],
        });

        expect(getFlowSpan("Shutoff")).toHaveTextContent("0");
        expect(getHeadInput("Shutoff")).toHaveValue("133");
        expect(getFlowInput("Design")).toHaveValue("50");
        expect(getHeadInput("Design")).toHaveValue("100");
        expect(getFlowInput("Max Operating")).toHaveValue("100");
        expect(getHeadInput("Max Operating")).toHaveValue("0");
      });

      it("emits onChange when changing from standard to design-point", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "curve",
          curve: [
            { x: 0, y: 150 },
            { x: 50, y: 100 },
            { x: 80, y: 10 },
          ],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(screen.getByRole("option", { name: /design point/i }));

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [{ x: 50, y: 100 }],
        });

        expect(getFlowSpan("Shutoff")).toHaveTextContent("0");
        expect(getHeadSpan("Shutoff")).toHaveTextContent("133");
        expect(getFlowInput("Design")).toHaveValue("50");
        expect(getHeadInput("Design")).toHaveValue("100");
        expect(getFlowSpan("Max Operating")).toHaveTextContent("100");
        expect(getHeadSpan("Max Operating")).toHaveTextContent("0");
      });
    });

    describe("changing from power type", () => {
      it("shows design-point in selector and table even when curve is invalid", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({ definitionType: "power", power: 50 });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(screen.getByRole("option", { name: /design point/i }));

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [{ x: 1, y: 1 }],
        });
        expect(select).toHaveTextContent(/design point/i);
        expect(screen.getByRole("table")).toBeInTheDocument();
      });

      it("shows standard in selector and table even when curve is invalid", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({ definitionType: "power", power: 50 });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(
          screen.getByRole("option", { name: /standard curve/i }),
        );

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [
            { x: 0, y: 1.33 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
          ],
        });
        expect(select).toHaveTextContent(/standard curve/i);
        expect(screen.getByRole("table")).toBeInTheDocument();
      });

      it("emits onChange when switching from power to design-point with 1-point curve", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "power",
          power: 50,
          curve: [{ x: 50, y: 100 }],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(screen.getByRole("option", { name: /design point/i }));

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [{ x: 50, y: 100 }],
        });
      });

      it("emits onChange when switching from power to design-point with 3-point curve", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "power",
          power: 50,
          curve: [
            { x: 0, y: 150 },
            { x: 50, y: 100 },
            { x: 80, y: 10 },
          ],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(screen.getByRole("option", { name: /design point/i }));

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [{ x: 50, y: 100 }],
        });
      });

      it("emits onChange when switching from power to standard with 3-point curve", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "power",
          power: 50,
          curve: [
            { x: 0, y: 150 },
            { x: 50, y: 100 },
            { x: 80, y: 10 },
          ],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(
          screen.getByRole("option", { name: /standard curve/i }),
        );

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [
            { x: 0, y: 150 },
            { x: 50, y: 100 },
            { x: 80, y: 10 },
          ],
        });
      });

      it("emits onChange when switching from power to standard with 1-point curve", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const pump = buildPump({
          definitionType: "power",
          power: 50,
          curve: [{ x: 50, y: 100 }],
        });

        render(
          <PumpDefinitionDetails
            pump={pump}
            quantities={quantities}
            onChange={onChange}
          />,
        );

        const select = screen.getByRole("combobox", { name: /pump type/i });
        await user.click(select);
        await user.click(
          screen.getByRole("option", { name: /standard curve/i }),
        );

        expect(onChange).toHaveBeenCalledWith({
          type: "curve",
          curve: [
            { x: 0, y: 133 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
          ],
        });
      });
    });
  });

  describe("external curve changes", () => {
    it("updates display when curve changes externally (e.g., undo)", () => {
      const onChange = vi.fn();
      const pump = buildPump({
        definitionType: "curve",
        curve: [{ x: 50, y: 100 }],
      });

      const { rerender } = render(
        <PumpDefinitionDetails
          pump={pump}
          quantities={quantities}
          onChange={onChange}
        />,
      );

      expect(getFlowInput("Design")).toHaveValue("50");
      expect(getHeadInput("Design")).toHaveValue("100");

      const pumpCopy = pump.copy();
      pumpCopy.setProperty("curve", [{ x: 75, y: 150 }]);

      rerender(
        <PumpDefinitionDetails
          pump={pumpCopy}
          quantities={quantities}
          onChange={onChange}
        />,
      );

      expect(getFlowInput("Design")).toHaveValue("75");
      expect(getHeadInput("Design")).toHaveValue("150");
    });

    it("updates selector when pump.definitionType changes externally (e.g., undo)", () => {
      const onChange = vi.fn();
      const pump = buildPump({
        definitionType: "curve",
        curve: [{ x: 50, y: 100 }],
      });

      const { rerender } = render(
        <PumpDefinitionDetails
          pump={pump}
          quantities={quantities}
          onChange={onChange}
        />,
      );

      expect(
        screen.getByRole("combobox", { name: /pump type/i }),
      ).toHaveTextContent(/design point/i);

      const updatedPump = pump.copy();
      updatedPump.setProperty("definitionType", "power");
      updatedPump.setProperty("power", 50);

      rerender(
        <PumpDefinitionDetails
          pump={updatedPump}
          quantities={quantities}
          onChange={onChange}
        />,
      );

      expect(
        screen.getByRole("combobox", { name: /pump type/i }),
      ).toHaveTextContent(/constant power/i);
    });
  });
});
